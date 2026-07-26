---
cssclasses:
  - cards
  - cards-1-1
  - cards-cols-4
type: report
---

# Campagne

```dataview
TABLE image
FROM -"__plugins/templates"
WHERE type = "mission" 
AND status = "done"
SORT fc-date ASC
```


