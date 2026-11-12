# Skip and Report

Every active study question has Skip and Report controls, including lecture,
typed-answer, and ordering questions. Controls belong to the student who started
the session; old revisions and duplicate clicks cannot skip additional questions.

Skip advances immediately without grading, showing an answer, awarding coins,
or rolling a Treasure Crate. Skipped questions appear separately from incorrect
answers in progress and completion summaries. Skipping the last question ends
the session. Public question cards lose their controls; feedback stays private.

Report opens a description form before or after answering. It sends the issue,
question ID, exact question, displayed choice order, expected answer, explanation,
and the question image to moderator channel `1549474402062704675`. Reporting does
not answer, skip, score, or reward a question. Forms retain their snapshot even
when the student advances. Existing duplicate, owner, server, expiration, and
delivery-retry checks still apply. The bot needs access to that moderator channel;
its visibility is governed by the server's channel permissions.

`npm run test:study` includes skip and report regressions. Report tests use mocked
Discord delivery and do not send real moderator messages.
