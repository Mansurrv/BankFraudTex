import unittest
from unittest.mock import patch

from main import CommunityRequest, Question, ScoreRequest, communities, intent, score


class AnalyticsTests(unittest.TestCase):
    def test_scoring_identifies_outlier_and_is_repeatable(self):
        records = {str(i): {"entity": str(i), "features": {"x": i % 3, "y": i % 4}} for i in range(30)}
        records["outlier"] = {"entity": "outlier", "features": {"x": 400, "y": 400}}
        request = ScoreRequest(fingerprints=records, names=["x", "y"])
        result = score(request)
        self.assertEqual(result, score(request))
        self.assertEqual(result["scores"]["outlier"], 1.0)

    def test_communities_preserve_isolated_accounts(self):
        result = communities(CommunityRequest(
            accounts=["a", "b", "c"],
            pairs=[{"sender": "a", "receiver": "b", "count": 20}],
        ))
        self.assertEqual(result["groups"], [["a", "b"], ["c"]])

    def test_intent_fallback_leaves_question_for_go(self):
        with patch("main.configured_provider", return_value=None):
            self.assertEqual(intent(Question(question="Explain activity")), {"intent": None})


if __name__ == "__main__":
    unittest.main()
