"""Testes unitários das regras de risco, faixas e abstenção (RF10, RF13, RF14, RF16)."""

import copy
import json
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase

from analysis.services import risk

RULES_DATA = json.loads(Path(settings.FAKE_EYES["RULES_FILE"]).read_text(encoding="utf-8"))


class RulesFileTests(SimpleTestCase):
    def test_rules_file_is_valid(self):
        rules = risk.load_rules()
        self.assertAlmostEqual(sum(rules.weights.values()), 1.0)
        self.assertTrue(all(w >= 0 for w in rules.weights.values()))

    def test_rejects_negative_weight(self):
        data = copy.deepcopy(RULES_DATA)
        data["risk_weights"] = {"a": 1.2, "b": -0.2}
        with self.assertRaises(risk.RulesError):
            risk.parse_rules(data)

    def test_rejects_weights_not_summing_to_one(self):
        data = copy.deepcopy(RULES_DATA)
        data["risk_weights"] = {"a": 0.5, "b": 0.4}
        with self.assertRaises(risk.RulesError):
            risk.parse_rules(data)


class RiskIndexTests(SimpleTestCase):
    weights = {"a": 0.5, "b": 0.3, "c": 0.2}

    def test_formula_all_signals(self):
        out = risk.compute_risk_index({"a": 1.0, "b": 0.5, "c": 0.0}, self.weights)
        self.assertAlmostEqual(out["value"], 100 * (0.5 + 0.15) / 1.0)
        self.assertEqual(out["signals_missing"], [])

    def test_missing_signal_is_ignored_and_renormalized(self):
        out = risk.compute_risk_index({"a": 1.0, "b": 0.5, "c": None}, self.weights)
        self.assertAlmostEqual(out["value"], round(100 * 0.65 / 0.8, 2))
        self.assertEqual(out["signals_missing"], ["c"])

    def test_deterministic(self):
        s = {"a": 0.37, "b": 0.11, "c": 0.9}
        self.assertEqual(risk.compute_risk_index(s, self.weights), risk.compute_risk_index(s, self.weights))

    def test_no_signals_returns_none(self):
        self.assertIsNone(risk.compute_risk_index({}, self.weights)["value"])

    def test_signal_out_of_range_raises(self):
        with self.assertRaises(ValueError):
            risk.compute_risk_index({"a": 1.5}, self.weights)


class StatusBandTests(SimpleTestCase):
    def setUp(self):
        self.rules = risk.load_rules()

    def test_band_boundaries_without_gaps(self):
        cases = {
            0: risk.STATUS_LOW, 25: risk.STATUS_LOW, 25.0: risk.STATUS_LOW,
            25.0001: risk.STATUS_ATTENTION, 25.5: risk.STATUS_ATTENTION, 60: risk.STATUS_ATTENTION,
            60.0: risk.STATUS_ATTENTION, 60.0001: risk.STATUS_HIGH, 100: risk.STATUS_HIGH,
        }
        for value, expected in cases.items():
            with self.subTest(value=value):
                self.assertEqual(risk.status_for_index(value, self.rules), expected)


class AbstentionTests(SimpleTestCase):
    def setUp(self):
        self.rules = risk.load_rules()

    def test_confident_has_no_reason(self):
        self.assertEqual(risk.abstention_reasons(rules=self.rules, model_confidence=0.99), [])

    def test_each_reason_is_distinct(self):
        r = self.rules
        self.assertEqual(risk.abstention_reasons(rules=r, model_confidence=0.99, out_of_scope=True),
                         [risk.ABSTAIN_OUT_OF_SCOPE])
        self.assertEqual(risk.abstention_reasons(rules=r, model_confidence=0.55),
                         [risk.ABSTAIN_LOW_CONFIDENCE])
        self.assertEqual(risk.abstention_reasons(rules=r, model_confidence=0.99, sources_conflict=True),
                         [risk.ABSTAIN_SOURCE_CONFLICT])
        strict = risk.parse_rules({**RULES_DATA, "abstention": {**RULES_DATA["abstention"], "require_evidence": True}})
        self.assertEqual(risk.abstention_reasons(rules=strict, model_confidence=0.99, evidence_available=False),
                         [risk.ABSTAIN_INSUFFICIENT_EVIDENCE])
        messages = {risk.ABSTENTION_MESSAGES[k] for k in risk.ABSTENTION_MESSAGES}
        self.assertEqual(len(messages), 4)

    def test_chunk_disagreement_triggers_low_confidence(self):
        reasons = risk.abstention_reasons(rules=self.rules, model_confidence=0.9, chunk_disagreement=0.45)
        self.assertEqual(reasons, [risk.ABSTAIN_LOW_CONFIDENCE])


class LinguisticIndicatorTests(SimpleTestCase):
    def setUp(self):
        self.cfg = risk.load_rules().linguistic

    def test_sensational_text_scores_higher(self):
        calm = risk.linguistic_indicators("O governo anunciou hoje novas medidas para a economia do país.", self.cfg)
        loud = risk.linguistic_indicators("URGENTE!!! COMPARTILHE antes que apaguem, a mídia não mostra!!!", self.cfg)
        self.assertLess(calm["signal"], loud["signal"])
        self.assertIn("urgente", loud["sensational_terms"])
        self.assertTrue(0 <= loud["signal"] <= 1)
