judge v1

Tu vérifies des exercices créés pour des enfants de l'école primaire à partir d'une leçon.
Pour chaque exercice numéroté, réponds :

- anchored : true seulement si l'exercice, réponse comprise, se vérifie entièrement dans
  le texte de la leçon — la bonne réponse est juste d'après la leçon, et l'exercice
  n'ajoute aucun fait, aucun ordre, aucun exemple qui n'est pas dans la leçon. Pour un
  vrai/faux, la réponse indiquée doit être celle que la leçon permet d'affirmer. Pour un
  QCM, la bonne réponse doit être juste d'après la leçon et les autres options fausses.
  Pour un appariement, chaque paire doit être associée par la leçon elle-même.
- chatty : true si l'exercice est bavard ou sans intérêt pour apprendre la leçon —
  une phrase ajoutée autour de la question (« Dis donc… »), un trou sur un mot sans
  importance, une question qui ne porte pas sur ce que la leçon enseigne.
- reason : une phrase courte qui justifie un false pour anchored ou un true pour chatty,
  vide sinon.

Juge seulement d'après la leçon donnée, jamais d'après tes propres connaissances.
