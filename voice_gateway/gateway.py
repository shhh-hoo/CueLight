"""Local PCM → Speechmatics Voice segments. No audio storage or Cue logic."""
import asyncio
import contextlib
import json
import logging
import os
import re
from pathlib import Path
from websockets.exceptions import InvalidStatus

from aiohttp import WSMsgType, web
from dotenv import load_dotenv
from speechmatics.rt import AuthenticationError, ConfigurationError, AudioError
from speechmatics.voice import (
    AgentServerMessageType as Event, VoiceAgentClient,
)

from config import GatewayConfig, parse_config

SETTINGS = web.AppKey("settings", GatewayConfig)
DRAIN_SECONDS = 10
ERRORS = {
    "authentication": "Speechmatics authentication failed. Check SPEECHMATICS_API_KEY in .env.local and restart the Voice gateway.",
    "configuration": "Unsupported Voice audio or configuration. Use mono pcm_f32le at 16 kHz and check Speechmatics language access.",
    "connection": "Speechmatics Voice connection failed. Check your network and account, then start a new session.",
    "provider": "Speechmatics Voice reported a service error. Check your account and start a new session.",
    "drain": "Voice SDK finalize/drain timed out. The last sentence may be incomplete; start a new session.",
    "protocol": "Invalid or stale Voice gateway session. Start a new microphone session.",
    "backpressure": "Voice processing could not keep up with the audio stream. Start a new session.",
}


def error_code(error):
    cause = error
    while cause:
        if isinstance(cause, AuthenticationError) or (isinstance(cause, InvalidStatus)
                and cause.response.status_code in {401, 403}):
            return "authentication"
        cause = cause.__cause__ or cause.__context__
    if isinstance(error, (ConfigurationError, AudioError, ValueError)):
        return "configuration"
    return "connection"


class DrainingVoiceClient(VoiceAgentClient):
    async def disconnect(self):
        try:
            await super().disconnect()
        finally:
            # 0.2.8 returns early after failed/cancelled connect and leaves its
            # STT task running. Cancel it here even when recognition never started.
            if self._stt_queue_task:
                self._stt_queue_task.cancel()
                await asyncio.gather(self._stt_queue_task, return_exceptions=True)
                self._stt_queue_task = None

    async def queue_barrier(self):
        # Voice 0.2.8 has no public awaitable finalize completion. This is the
        # private SDK boundary: callbacks run FIFO after transcript handling.
        # Pin both SDKs; reverify this method before upgrading. No word events
        # are consumed here, and no segmentation logic is implemented locally.
        done = asyncio.get_running_loop().create_future()
        self._stt_message_queue.put_nowait(lambda: done.set_result(None) if not done.done() else None)
        await done

    async def drain_segments(self):
        forced = asyncio.Event()
        def on_eou(message):
            if message.get("forced") is True:
                forced.set()
        self.on(Event.END_OF_UTTERANCE, on_eou)
        try:
            # Public inherited SDK API. A forced EOU confirms the provider has
            # finalized the sent audio, including speech still in flight at Stop.
            await self.force_end_of_utterance()
            await forced.wait()
            await self.queue_barrier()
            self.finalize()  # synchronous API; schedules its own async flush
            await asyncio.sleep(0)  # let finalize enqueue its callback
            await self.queue_barrier()
        finally:
            self.off(Event.END_OF_UTTERANCE, on_eou)


def local_request(request):
    host = request.host
    origin = request.headers.get("Origin")
    return bool(re.fullmatch(r"(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?", host)) and (
        origin is None or origin == f"http://{host}"
    )


async def status(request):
    if not local_request(request):
        raise web.HTTPForbidden()
    return web.json_response({"configured": bool(request.app[SETTINGS].api_key.strip()),
                              "configuration": request.app[SETTINGS].diagnostics()}, headers={"Cache-Control": "no-store"})


async def session(request):
    # Vite proxies the original loopback Host and Origin without changing them.
    if not local_request(request) or not request.headers.get("Origin"):
        raise web.HTTPForbidden()
    ws = web.WebSocketResponse(max_msg_size=256 * 1024, heartbeat=15)
    await ws.prepare(request)
    settings = request.app[SETTINGS]
    client = None
    session_id = None
    active = True
    sequence = 0
    cycle = 0
    outgoing = asyncio.Queue(maxsize=128)
    incoming = asyncio.Queue(maxsize=128)
    failure = asyncio.get_running_loop().create_future()

    def fail(code):
        if not failure.done():
            failure.set_result(code)

    def emit(kind, **fields):
        if active:
            try:
                outgoing.put_nowait({"type": kind, "sessionId": session_id, **fields})
            except asyncio.QueueFull:
                fail("backpressure")

    async def receive_frames():
        # Independent reader detects reset/page exit even during connect or drain.
        async for message in ws:
            try:
                incoming.put_nowait(message)
            except asyncio.QueueFull:
                fail("backpressure")
                return

    async def send_events():
        while True:
            event = await outgoing.get()
            try:
                await ws.send_json(event)
            finally:
                outgoing.task_done()

    def on_segment(message):
        nonlocal sequence, cycle
        if not active:
            return
        cycle += 1
        segments = []
        # Stable source order within an event; preserve provider wording verbatim.
        for segment in sorted(message.get("segments", []), key=lambda s: (
            s.get("metadata", {}).get("end_time", 0), s.get("metadata", {}).get("start_time", 0)
        )):
            sequence += 1
            segments.append({"sequence": sequence, "text": segment.get("text"),
                             "startSeconds": segment.get("metadata", {}).get("start_time"),
                             "endSeconds": segment.get("metadata", {}).get("end_time"),
                             "speakerId": segment.get("speaker_id"), "language": segment.get("language")})
        emit("segments", cycle=cycle, segments=segments)

    def on_error(message):
        # Provider bodies can include sensitive data; forward only allowlisted codes.
        kind = message.get("type", "")
        fail("authentication" if kind in {"not_authorised", "not_authorized"} else
             "configuration" if kind in {"invalid_audio_type", "invalid_model", "invalid_config", "invalid_sample_rate"}
             else "provider")

    async def run():
        nonlocal client, session_id
        message = await asyncio.wait_for(incoming.get(), 10)
        if message.type != WSMsgType.TEXT:
            raise ValueError("start required")
        start = json.loads(message.data)
        session_id = start.get("sessionId")
        rate = start.get("sampleRate")
        if (start.get("type") != "start" or not isinstance(session_id, str)
                or not re.fullmatch(r"[a-zA-Z0-9-]{1,80}", session_id)):
            fail("protocol")
            return
        if type(rate) is not int or rate not in {8000, 16000} or start.get("encoding") != "pcm_f32le":
            fail("configuration")
            return
        if not settings.api_key.strip():
            fail("authentication")
            return
        config = settings.voice_config(rate)
        client = DrainingVoiceClient(api_key=settings.api_key, config=config)
        client.on(Event.ADD_SEGMENT, on_segment)
        client.on(Event.ERROR, on_error)
        # ADD_PARTIAL_SEGMENT and legacy transcripts have no application handlers.
        await asyncio.wait_for(client.connect(), 10)
        emit("started", configuration=settings.diagnostics(rate))
        while True:
            message = await incoming.get()
            if message.type == WSMsgType.BINARY:
                if not message.data or len(message.data) % 4:
                    fail("configuration")
                    return
                await asyncio.wait_for(client.send_audio(message.data), 5)
            elif message.type == WSMsgType.TEXT:
                command = json.loads(message.data)
                if command.get("sessionId") != session_id or command.get("type") != "stop":
                    fail("protocol")
                    return
                try:
                    await asyncio.wait_for(client.drain_segments(), DRAIN_SECONDS)
                except asyncio.TimeoutError:
                    fail("drain")
                    return
                emit("drained")  # FIFO behind every ADD_SEGMENT
                # The browser drains Jev before permitting SDK disconnect.
                reply = await asyncio.wait_for(incoming.get(), 20)
                if reply.type in {WSMsgType.CLOSE, WSMsgType.CLOSED, WSMsgType.ERROR}:
                    return
                if reply.type != WSMsgType.TEXT:
                    fail("protocol")
                    return
                command = json.loads(reply.data)
                if command.get("sessionId") != session_id or command.get("type") != "finish":
                    fail("protocol")
                    return
                await asyncio.wait_for(client.disconnect(), 7)
                emit("stopped")
                await outgoing.join()
                return
            else:
                return

    receiver = asyncio.create_task(receive_frames())
    sender = asyncio.create_task(send_events())
    runner = asyncio.create_task(run())
    try:
        done, _ = await asyncio.wait({runner, sender, receiver, failure}, return_when=asyncio.FIRST_COMPLETED)
        if runner in done:
            try:
                runner.result()
            except asyncio.TimeoutError:
                fail("connection")
            except Exception as error:
                fail(error_code(error))
        if failure.done():
            emit("error", code=failure.result(), message=ERRORS[failure.result()])
            with contextlib.suppress(Exception):
                await asyncio.wait_for(outgoing.join(), 1)
    finally:
        active = False  # callbacks lose authority before cancelling/closing
        for task in (runner, sender, receiver):
            task.cancel()
        await asyncio.gather(runner, sender, receiver, return_exceptions=True)
        failure.cancel()
        if client:
            # close() is the public immediate cancellation API. Do it first on
            # reset/loss so disconnect cannot spend five seconds awaiting audio.
            with contextlib.suppress(Exception):
                await asyncio.wait_for(client.close(), 3)
            with contextlib.suppress(Exception):
                await asyncio.wait_for(client.disconnect(), 3)
        await ws.close()
    return ws


def create_app(env=None):
    settings = parse_config(os.environ if env is None else env)
    app = web.Application()
    app[SETTINGS] = settings
    app.router.add_get('/api/voice/status', status)
    app.router.add_get('/api/voice/session', session)
    return app


if __name__ == '__main__':
    load_dotenv(Path(__file__).resolve().parents[1] / '.env.local')
    # SDK exceptions / URLs are never logged with credentials or provider bodies.
    provider_logger = logging.getLogger('speechmatics')
    provider_logger.addHandler(logging.NullHandler())
    provider_logger.propagate = False
    web.run_app(create_app(), host='127.0.0.1', port=8765, access_log=None)
