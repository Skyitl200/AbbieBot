# Personal question toggles in /test

Every set setup offers **Choose questions**. Lab sets show it on the answer-mode
screen; lecture topics and saved database classes show it on the length screen.
This covers specific chapters/categories and mixed/random practice.

The private picker lists ten questions per page, with ON/OFF state and prompt
previews. Selecting one or more entries sets their displayed target state and
refreshes the list. **Back to set** updates the enabled count. All questions start
ON; questions added later also default ON. If every question is OFF, the setup
offers recovery instead of starting an empty test.

During a test, **Turn off for future quizzes** appears beside Skip and Report.
This saves the preference without scoring, skipping or changing the current
question. **Turn question back on** and the private **Turned-off questions**
manager allow restoration. Selection applies when creating new sessions;
already-created sessions keep their current questions and scoring.

Preferences are scoped to a Discord member in a server and stored in a
non-expiring, versioned PostgreSQL `temp_data` record. Stable question IDs apply
across visits, bot restarts and multiple-choice/typed variants. No migration is
needed. Advisory locks serialize concurrent changes so one question update
cannot overwrite another. Explicit ON/OFF operations are idempotent under retries.
Users cannot use another member's controls or selection contexts.

Lab and authored lecture pools filter before session selection. Saved question
bank queries exclude disabled IDs before random ordering and LIMIT, preventing
underfilled sessions when an enabled pool still has enough questions. Setup
categories remain browsable even when their questions are all OFF.

Picker contexts expire after two hours; saved preferences do not expire. Reopen
Choose questions to get a fresh picker. Standalone authored-bank previews without
a bot database wrapper remain supported, but deployed bot clients must use their
persistent database and do not silently fall back to volatile preference storage.

Validation: `node --test tests/question-preferences.test.js tests/study.test.js
tests/spinal-nerves.test.js tests/question-reports.test.js tests/study-usage-limit.test.js`.
