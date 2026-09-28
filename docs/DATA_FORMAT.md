# Exam Atlas data format

The **Data & backup** tab exports one readable JSON document. This makes your study data portable and keeps future migrations straightforward.

```json
{
  "format": "exam-atlas-backup",
  "version": 1,
  "exported_at": "2026-09-27T12:00:00.000Z",
  "notes": [],
  "progress": []
}
```

## Note fields

| Field | Type | Purpose |
| --- | --- | --- |
| `id` | string | Stable note identifier |
| `title` | string | Human-readable note name |
| `question_id` | string | Exam/paper question identifier |
| `exam` | string | Exam or paper name |
| `year` | number or null | Question year |
| `topics` | string array | Searchable concepts that also become graph nodes |
| `difficulty` | `easy`, `medium`, or `hard` | Subjective difficulty |
| `status` | `understood`, `review`, or `mastered` | Learning state |
| `body` | string | Full solution approach |
| `key_insight` | string | The idea that unlocks the problem |
| `traps` | string | Mistakes and misleading paths |
| `formulas` | string | Useful identities or shortcuts |
| `refs` | string | References and links |
| `related_note_ids` | string array | Explicit connections to other notes |
| `created_at` | ISO timestamp | Used for notes-added-per-day trends |
| `updated_at` | ISO timestamp | Last modification time |

## Progress fields

| Field | Type | Purpose |
| --- | --- | --- |
| `log_date` | `YYYY-MM-DD` | Local study date |
| `questions_solved` | number | Total questions completed that day |
| `study_minutes` | number | Focused study duration |
| `reflection` | string | Optional daily observation |

During import, every item is assigned to the currently signed-in account. Notes are merged by `id`; progress entries are merged by date. This prevents one user's exported `user_id` from affecting another account.
