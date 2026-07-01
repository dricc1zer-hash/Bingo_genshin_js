# Bingo Genshin Impact

Version JavaScript du jeu de bingo initialement écrit en Python/Tkinter.

## Lancer le jeu

Le jeu est une application web statique. Pour un test local fiable, lancez un petit serveur dans ce dossier puis ouvrez `index.html`. Sur GitHub, il peut être publié directement avec GitHub Pages.

## Fonctionnalités portées

- Grille 5 x 5 générée depuis la liste de propositions.
- Mode `Normal` et mode `Facile` avec région affichée.
- Filtre par longueur minimum et maximum.
- Chronomètre avec limite de temps.
- Quatre joueurs/couleurs : vert, rouge, bleu, jaune.
- Cases multi-couleurs.
- Calcul des scores : cases validées + bonus par ligne, colonne ou diagonale complète.

## Fichiers utiles

- `index.html` : page du jeu.
- `styles.css` : mise en page.
- `app.js` : logique JavaScript.
- `Ayaka.png` : image du menu.
- `Liste.txt` et `Crédits.txt` : données d'origine.
- `BINGO.py` : source Python d'origine, conservée comme référence.

## Publication GitHub

Les dossiers de build Python sont ignorés par `.gitignore` afin de garder un dépôt léger.
