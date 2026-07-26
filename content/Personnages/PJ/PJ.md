---
cssclasses:
  - cards
  - cards-1-1
  - cards-cols-3
type: report
---
# PJ

IA : [[IA - Manticore-printall.pdf]]
```dataview
   TABLE portrait as Portrait, fiche-joueur as Fiche, metaarmure as "Méta-armure", section as Section, avantages as Avantages, inconvenients as Inconvénients, motivationmajeure as "Motivation Majeure"
   FROM -"__plugins/templates" 
   WHERE type = "pj" and file.name != "Sarge"
   SORT nom desc
```