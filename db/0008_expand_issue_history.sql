BEGIN;

ALTER TABLE qa_decision_memories
  ADD COLUMN related_url varchar(2048);

ALTER TABLE qa_decision_memories
  DROP CONSTRAINT chk_qa_decision_memories_decision_type;

ALTER TABLE qa_decision_memories
  ADD CONSTRAINT chk_qa_decision_memories_decision_type CHECK (
    decision_type IN (
      'RELEASE', 'RISK_ACCEPTANCE', 'TEST_SCOPE', 'REGRESSION',
      'DEFECT_DISPOSITION', 'OTHER', 'DELIVERY_ISSUE',
      'REMAINING_ISSUE', 'REMAINING_TEST', 'LIVE_ISSUE_RESPONSE'
    )
  );

COMMIT;
