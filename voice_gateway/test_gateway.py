"""Protocol/lifecycle contracts, plus the installed SDK's actual finalize queue."""
import asyncio
import json
import unittest
from unittest.mock import patch

from aiohttp.test_utils import TestClient, TestServer
from speechmatics.voice import AgentServerMessageType as Event, VoiceAgentConfigPreset
from gateway import DrainingVoiceClient, create_app


class StubVoice:
    instances = []
    fail_connect = False
    drain_timeout = False

    def __init__(self, **kwargs):
        self.handlers = {}
        self.audio = []
        self.closed = False
        self.disconnected = False
        self.instances.append(self)

    def on(self, event, callback):
        self.handlers[event] = callback

    async def connect(self):
        if self.fail_connect:
            from speechmatics.rt import AuthenticationError
            raise AuthenticationError('sensitive provider body')

    async def send_audio(self, data):
        self.audio.append(data)

    async def drain_segments(self):
        if self.drain_timeout:
            raise asyncio.TimeoutError()
        self.handlers[Event.ADD_SEGMENT]({'segments': [
            {'text': 'The final teaching sentence.', 'speaker_id': 'S1', 'language': 'en',
             'metadata': {'start_time': 1.0, 'end_time': 4.0}},
        ]})

    async def close(self):
        self.closed = True

    async def disconnect(self):
        self.disconnected = True


class ProtocolTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.stub = patch('gateway.DrainingVoiceClient', StubVoice)
        self.env = patch.dict('os.environ', {'SPEECHMATICS_API_KEY': 'test-only'})
        self.stub.start(); self.env.start()
        StubVoice.instances = []
        StubVoice.fail_connect = False
        StubVoice.drain_timeout = False
        self.http = TestClient(TestServer(create_app()))
        await self.http.start_server()
        self.origin = str(self.http.make_url('')).rstrip('/')

    async def asyncTearDown(self):
        await self.http.close()
        self.stub.stop(); self.env.stop()

    async def start(self, sid='first'):
        ws = await self.http.ws_connect('/api/voice/session', origin=self.origin)
        await ws.send_json({'type': 'start', 'sessionId': sid, 'sampleRate': 16000, 'encoding': 'pcm_f32le'})
        return ws, await ws.receive_json()

    async def test_stop_drains_before_disconnect_and_no_partial_or_raw_handlers(self):
        ws, started = await self.start()
        self.assertEqual(started['type'], 'started')
        client = StubVoice.instances[-1]
        self.assertEqual(set(client.handlers), {Event.ADD_SEGMENT, Event.ERROR})
        await ws.send_bytes(b'\x00' * 128)
        await ws.send_json({'type': 'stop', 'sessionId': 'first'})
        segment = await ws.receive_json()
        self.assertEqual(segment['segments'][0]['text'], 'The final teaching sentence.')
        self.assertEqual(segment['sessionId'], 'first')
        self.assertEqual((await ws.receive_json())['type'], 'drained')
        self.assertFalse(client.disconnected)
        self.assertEqual(client.audio, [b'\x00' * 128])
        await ws.send_json({'type': 'finish', 'sessionId': 'first'})
        self.assertEqual((await ws.receive_json())['type'], 'stopped')
        self.assertTrue(client.disconnected)
        await ws.close()

    async def test_cancel_then_new_session_discards_old_callbacks_and_stale_control(self):
        old, _ = await self.start()
        client = StubVoice.instances[-1]
        await old.close()
        fresh, _ = await self.start('second')
        # Allow the cancelled handler's cleanup to complete.
        for _ in range(20):
            if client.closed:
                break
            await asyncio.sleep(.01)
        self.assertTrue(client.closed)
        client.handlers[Event.ADD_SEGMENT]({'segments': [{'text': 'old', 'metadata': {'start_time': 0, 'end_time': 1}}]})
        await fresh.send_json({'type': 'stop', 'sessionId': 'first'})
        self.assertEqual((await fresh.receive_json())['code'], 'protocol')
        await fresh.close()

    async def test_auth_and_drain_errors_are_actionable_and_redacted(self):
        StubVoice.fail_connect = True
        ws, error = await self.start()
        self.assertEqual(error['code'], 'authentication')
        self.assertNotIn('sensitive', json.dumps(error))
        await ws.close()
        StubVoice.fail_connect = False
        StubVoice.drain_timeout = True
        ws, _ = await self.start('timeout')
        await ws.send_json({'type': 'stop', 'sessionId': 'timeout'})
        self.assertEqual((await ws.receive_json())['code'], 'drain')
        await ws.close()

    async def test_cross_origin_access_is_denied(self):
        response = await self.http.get('/api/voice/status', headers={'Origin': 'https://unrelated.example'})
        self.assertEqual(response.status, 403)


class InstalledSDKTests(unittest.IsolatedAsyncioTestCase):
    async def test_forced_flush_waits_for_actual_sdk_segment_queue_and_empty_session(self):
        client = DrainingVoiceClient(api_key='test-only', config=VoiceAgentConfigPreset.CAPTIONS())
        client._start_stt_queue()
        client.emit(Event.RECOGNITION_STARTED, {'id': 'test', 'language_pack_info': {'language_description': 'English', 'word_delimiter': ' '}})
        received = []
        client.on(Event.ADD_SEGMENT, received.append)
        async def force():
            # Simulate a provider final delivered at Stop, not earlier in the session.
            client.emit(Event.ADD_TRANSCRIPT, {'results': [
                {'type': 'word', 'start_time': i*.3, 'end_time': (i+1)*.3,
                 'alternatives': [{'content': word, 'speaker': 'S1', 'confidence': .99}]}
                for i, word in enumerate(['The', 'last', 'sentence'])
            ], 'metadata': {'start_time': 0, 'end_time': .9, 'transcript': 'The last sentence'}})
            client.emit(Event.END_OF_UTTERANCE, {'forced': True, 'metadata': {'start_time': .9, 'end_time': .9}})
        client.force_end_of_utterance = force
        try:
            await asyncio.wait_for(client.drain_segments(), 1)
            self.assertEqual([s['text'] for event in received for s in event['segments']], ['The last sentence'])
            # An already-finalized/empty session must not wait for a nonexistent EndOfTurn.
            async def empty_force():
                client.emit(Event.END_OF_UTTERANCE, {'forced': True, 'metadata': {'start_time': 1, 'end_time': 1}})
            client.force_end_of_utterance = empty_force
            await asyncio.wait_for(client.drain_segments(), 1)
            self.assertEqual(len(received), 1)
        finally:
            await client.disconnect()
        self.assertIsNone(client._stt_queue_task)
