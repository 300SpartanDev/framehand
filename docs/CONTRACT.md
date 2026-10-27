# framehand project contract

The single source is [skills/framehand/references/contract.md](../skills/framehand/references/contract.md). It ships with the skill, and it is the copy the agent reads. No second copy is kept here, so the two cannot drift apart.

In one line: a project is one composition `index.html` (HTML plus GSAP, rendered frame by frame in your own Chrome), made pointable and editable by three kinds of annotation:
- composition variables: values that can be changed directly;
- `data-om-id`: things that can be pointed at;
- timeline labels `scene:<id>`: the shots.
