---
publish: true
created: 2026-11-12T11:32:08.299Z
modified: 2026-11-12T11:40:36.079Z
---

# Test Quartz Syncer

Nom : Quartz Syncer

PJ : Forge

```dataview
TABLE WITHOUT ID
  file.link AS "Note",
  type AS "Type"
WHERE file.path = this.file.path
```
