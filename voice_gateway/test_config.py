import json
import unittest
from speechmatics.voice import AudioEncoding, VoiceAgentConfig, VoiceAgentConfigPreset
from config import parse_config
from gateway import create_app

class ConfigTests(unittest.TestCase):
    def test_default_and_both_official_presets_with_required_overlay(self):
        self.assertEqual(parse_config({}).preset, 'captions')
        for name, preset in [('captions', VoiceAgentConfigPreset.CAPTIONS), ('scribe', VoiceAgentConfigPreset.SCRIBE)]:
            for rate in (8000, 16000):
                settings = parse_config({'SPEECHMATICS_VOICE_PRESET': name, 'SPEECHMATICS_API_KEY': 'secret-test'})
                expected = preset(VoiceAgentConfig(language='cmn_en', sample_rate=rate, audio_encoding=AudioEncoding.PCM_F32LE))
                self.assertEqual(settings.voice_config(rate).model_dump(), expected.model_dump())
                exported = settings.diagnostics(rate)
                self.assertEqual(exported['preset'], name)
                self.assertEqual(exported['operatingPoint'], 'enhanced')
                self.assertEqual(exported['sampleRate'], rate)
                self.assertNotIn('secret-test', json.dumps(exported))

    def test_invalid_fails_before_app_starts(self):
        for value in ('', 'CAPTIONS', 'fast', ' scribe', 'secret-test'):
            with self.assertRaisesRegex(ValueError, 'SPEECHMATICS_VOICE_PRESET must be captions or scribe'):
                create_app({'SPEECHMATICS_VOICE_PRESET': value})
