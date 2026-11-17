# PromptShield Context v1.3

Local multinomial logistic regression token classifier, combined with deterministic rules. Trained on synthetic English and Hinglish templates; no user data. Run `python scripts/train_detector.py` with numpy and scikit-learn to reproduce. Word shape features match the TypeScript runtime. Runtime uses exported coefficients in TypeScript.

Detects contextual names, addresses, credentials, health details, personal finance and confidential plans. Scores are model probabilities, not guarantees. This is a small prototype model, not a pretrained LLM. Unseen phrasing, other languages, OCR and implied secrets may be missed. Negated or hypothetical statements can produce false positives. Human review remains required.

Evaluation holds out two complete templates per category and separate values. The reported token classifier metrics exclude runtime thresholds and context rules; the checked-in behavioral tests cover the integrated scanner. It does not measure real-world accuracy. Full per-class metrics, training size and threshold are recorded in context-model.json.


## Desktop credential classification update

The token model weights and training version remain v1.3. A deterministic classification layer now distinguishes password, OTP, API key, access token, private key, connection string, generic secret and uncertain credential findings. Recognized spreadsheet column headers identify dedicated secret fields, including short values and passphrases containing spaces. Explicit labels are resolved before broad model labels. All credential subtypes retain the existing critical/blocking policy. Placeholder prefixes follow the displayed category. Quoted natural-language passphrases are masked as complete values. Already-redacted references and unset cells are excluded. Regression tests measure these specified behaviors only; they are not a real-world accuracy estimate.
