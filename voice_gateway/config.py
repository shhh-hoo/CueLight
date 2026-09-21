"""Validated gateway settings; SDK/audio contracts are deliberately not env knobs."""
from dataclasses import dataclass, field
from speechmatics.voice import AudioEncoding, VoiceAgentConfig, VoiceAgentConfigPreset

PRESETS = {'captions': VoiceAgentConfigPreset.CAPTIONS, 'scribe': VoiceAgentConfigPreset.SCRIBE}

@dataclass(frozen=True)
class GatewayConfig:
    preset: str
    api_key: str = field(repr=False)

    def voice_config(self, sample_rate):
        return PRESETS[self.preset](VoiceAgentConfig(
            language='cmn_en', sample_rate=sample_rate, audio_encoding=AudioEncoding.PCM_F32LE,
        ))

    def diagnostics(self, sample_rate=None):
        config = self.voice_config(sample_rate or 16000)
        return {
            'preset': self.preset, 'language': config.language,
            'operatingPoint': config.operating_point.value,
            'audioEncoding': config.audio_encoding.value, 'channels': 1,
            'voiceVersion': '0.2.8', 'rtVersion': '1.1.1',
            **({'sampleRate': sample_rate} if sample_rate is not None else {}),
        }

def parse_config(env):
    preset = env.get('SPEECHMATICS_VOICE_PRESET', 'scribe')
    if preset not in PRESETS:
        raise ValueError('SPEECHMATICS_VOICE_PRESET must be captions or scribe.')
    return GatewayConfig(preset=preset, api_key=env.get('SPEECHMATICS_API_KEY', ''))
