# UNLOCK Content / Lecturer-IP Threat Model

Status: DRAFT — product/security analysis only. This document does not
implement anything, does not change any code, and does not decide any
schema. It is deliberately forward-looking: as of this writing there is no
Auth, no RLS policy (every V1 table has RLS enabled with zero policies —
ADR-013 — a safe deny-by-default posture, not an authorization model), no
file-upload/storage code, and no Material persistence beyond the conceptual
description in `docs/DATABASE.md` §6. The purpose of analyzing risk now,
before any of this is built, is so the eventual storage/RAG/AI-generation
architecture is designed against these risks from day one rather than
retrofitted after a leak.

This document assumes the membership/authorization model described in
`docs/COURSE_ACCESS_MODEL_DRAFT.md` (Course, membership, roles) as its
starting point for "who is an authorized learner/lecturer/staff member,"
and does not re-derive or compare membership models here — see that
document for the authorization architecture options. This document is
scoped to content/IP exposure specifically: what happens to a piece of
lecturer/course material once it exists in the system, independent of
exactly how membership is modeled.

**No claim in this document should be read as promising DRM-like
protection.** UNLOCK cannot and does not attempt to prevent a legitimate,
authorized learner from copying, retyping, photographing, or otherwise
extracting content that the product has correctly and legitimately shown
them. This is stated once here and repeated at the relevant sections below
because it is the single most important framing fact in this analysis.

---

## 1. Threat model scope

**In scope**: leakage of lecturer-owned or institution-owned source
material (uploaded PDFs, lecture notes, presentations, proprietary
question banks) to parties who should not have access to the *original
source content* — even when those parties may legitimately have access to
*derived learning content* (generated questions, explanations) built from
it.

**Explicitly not in scope**: general platform security (SQL injection,
XSS, CSRF, credential theft) — those are ordinary web-application security
concerns covered by `docs/ARCHITECTURE.md` §31 and a future
`security-review`, not IP-specific. This document is about content
provenance and visibility, not application security hygiene in general.

**Actors**:

- **Learner** — has legitimate access to a Course's *learning* content
  (Questions, explanations) via an active membership.
- **Lecturer / course-management role** — uploads and owns source Material
  for a Course they administer.
- **Institution staff/admin** — may have elevated visibility across
  Courses at an institution (role and scope not yet decided — see
  `docs/COURSE_ACCESS_MODEL_DRAFT.md`).
- **Platform staff/admin** — UNLOCK's own operators, with infrastructure
  (not necessarily product-role) access to the database/storage/logs.
- **Ex-member** — a learner or staff member whose membership was later
  revoked or who left an archived Course.
- **External/unauthorized party** — anyone with no membership at all.

---

## 2. Risks the product CAN technically mitigate

For each: mechanism of leakage, who is exposed, and the control that
addresses it. These are architectural recommendations for the *future*
Material/storage/AI-generation design — nothing here is implemented yet.

### 2.1 Public/guessable storage URLs

**Mechanism**: an uploaded source file (PDF, slides) is stored at a
predictable or publicly-readable URL (e.g. a public Supabase Storage
bucket, or an object key derivable from a Course/Material id).
**Exposed**: lecturer/institution (source file), to any external party who
guesses or scans URLs.
**Control**: source Material must live in a **private** storage bucket
with no public ACL. Every read must go through a short-lived, narrowly
scoped **signed URL** minted server-side only after the requesting
principal's active membership/role has been checked — never a bucket
configured for public or "anyone with the link" access. Signed URLs should
have a short expiry (minutes, not days) and should not be embedded in
anything long-lived (emails, cached pages).

### 2.2 Service-role key leakage or misuse

**Mechanism**: Supabase's `service_role` key (which bypasses RLS entirely
— ADR-013) is exposed client-side, checked into source control, or used
from a code path reachable by untrusted input, giving effectively
unrestricted read access to all storage/DB content.
**Exposed**: every Course's material, for every lecturer/institution.
**Control**: `docs/ARCHITECTURE.md` §31/§51 already establish this
principle generally — service-role credentials remain strictly
server-side, in code paths not reachable by direct user input, and are
never sent to a browser bundle or public environment variable. This is a
platform-wide discipline, not something specific to Material, but Material
is the highest-value target it protects.

### 2.3 RLS/authorization gaps on Material rows or storage objects

**Mechanism**: once real RLS policies exist (currently: none — ADR-013),
a policy could be written too permissively (e.g. "any authenticated user
can read any Material row/file"), or a storage bucket's policy could
diverge from the DB-row-level policy protecting the same content.
**Exposed**: lecturer/institution material, to any authenticated user
platform-wide, not just Course members.
**Control**: Material visibility policies must be scoped to *active
membership* in the owning Course (per whatever model
`docs/COURSE_ACCESS_MODEL_DRAFT.md` settles on), and storage-object
policies must be kept in lockstep with the DB-row policy protecting the
same Material — ideally derived from the same membership check rather than
maintained as two independently-written policies that can drift. RLS
policies, once written, must be tested (`docs/DATABASE.md` §29,
`docs/MASTER_SPEC.md` §52) specifically including a "non-member cannot
read" negative test per Material-adjacent table.

### 2.4 Access surviving membership revocation or Course archival

**Mechanism**: a learner is removed from a Course (or a membership
expires, or the learner leaves an institution), but already-issued signed
URLs, cached session tokens, or an unrevoked API session continue to grant
read access to source Material after the point access should have ended.
**Exposed**: lecturer/institution material, to a party whose authorization
has ended.
**Control**: signed URLs should already be inherently mitigated by short
expiry (2.1); any longer-lived access token/session used to mint new
signed URLs must be re-checked against *current* membership state on every
mint, not cached from session start. Archiving a Course (learner-initiated
archive, per the Course/Membership product direction) must **not** revoke
the learner's own historical Attempts/Progress (durable per ADR-005), but
it also must not implicitly continue granting fresh reads of *source*
Material — archived-but-previously-a-member is a state the authorization
check must handle explicitly, not accidentally fall through to "was ever a
member = still allowed."

### 2.5 Derived questions/explanations leaking large verbatim source excerpts

**Mechanism**: an AI-generated (or manually authored) Question or
explanation reproduces a large, recognizable verbatim excerpt of the
source Material (a paragraph of lecture notes, a full proof, a slide's
exact text) rather than a genuinely transformed learning artifact,
effectively republishing the source content to every Course member even if
they never had direct access to the original file.
**Exposed**: lecturer/institution (their authored material, now
effectively re-published in full to a broader or differently-scoped
audience than the original file's access list); the learner is *not*
exposed to unauthorized content here — this risk is about the *lecturer's*
distribution control, not learner-facing security.
**Control**: the generation pipeline (`docs/MASTER_SPEC.md` §9.2/§10/§11)
already requires structured, schema-validated output plus a two-pass
verification workflow — that pipeline is the natural place to add an
excerpt-length/similarity check against the source chunk (e.g. reject or
flag a candidate Question/explanation whose textual overlap with the cited
source chunk exceeds a threshold) before a generated item is promoted to
learner-facing. This is a content-quality gate that already exists in
concept for correctness; extending it to check source-similarity is an
additive check on the same pipeline, not a new subsystem.

### 2.6 AI provider retaining or exposing submitted source content

**Mechanism**: source Material text sent to a third-party AI provider for
question generation is retained by that provider (for model training,
logging, or a data breach on their end) beyond what the product intended.
**Exposed**: lecturer/institution material, to the AI provider and
anyone who later compromises the provider's systems.
**Control**: `docs/ARCHITECTURE.md` §17's AI provider abstraction is the
right place to enforce a provider-level data-retention policy (opt out of
training-data retention where the provider offers it, prefer providers
with a data-processing agreement suited to educational content) as a
platform-wide AI-operations decision, not a Material-specific one. This is
a vendor/contract control, not purely a technical one — flagged here as a
requirement for whichever AI provider is selected, not a decision this
document makes.

### 2.7 Staff/admin over-broad access

**Mechanism**: an institution admin or platform admin role is granted (or
defaults to) read access to source Material for Courses/institutions they
do not actually administer, because the role model does not scope
"admin" narrowly enough.
**Exposed**: lecturer/institution material, to platform/institution staff
outside the intended management chain.
**Control**: admin/staff roles must be scoped to the specific
Course(s)/institution(s) they administer (per
`docs/COURSE_ACCESS_MODEL_DRAFT.md`'s eventual role model), not a single
platform-wide "is staff" boolean. Platform-operator access (e.g. for
support or incident response) should be logged/auditable and treated as an
exceptional, not routine, access path.

### 2.8 Logs/backups retaining source content indefinitely

**Mechanism**: application logs, error traces, or AI-request logs capture
full source Material text (e.g. logging the full prompt sent to an AI
provider, or a stack trace that includes file contents), and these logs
are retained, broadly readable by engineering staff, or backed up beyond
the retention the product intends for the source itself (e.g. after a
lecturer deletes a Material).
**Exposed**: lecturer/institution material, to platform engineering
staff via log access, for longer than the product's stated retention.
**Control**: logging of AI requests/responses should log metadata
(Material id, chunk id, model, token counts, verification outcome) rather
than full source text bodies by default; if content is genuinely needed in
logs for debugging, retention and access should match the sensitivity of
the source content, not the platform's generic log retention. This is a
concrete, gate-able logging-hygiene decision, not aspirational — it should
be a requirement written into whichever logging/observability tooling is
eventually chosen (`docs/ARCHITECTURE.md` §65's "exact tools are TBD").

### 2.9 Deleted Material remaining accessible via stale references

**Mechanism**: a lecturer deletes/retires a Material, but a previously
generated signed URL, a cached derived Question still citing it, or a
vector-store embedding built from it continues to be servable.
**Exposed**: lecturer/institution material, after the lecturer's explicit
deletion intent.
**Control**: this connects directly to the still-open
`docs/OPEN_QUESTIONS.md` #27/#28 (data deletion / Question retirement
semantics) and #48 (vector data) in `docs/DATABASE.md` — whatever
deletion/retirement design is eventually chosen for Material must also
specify what happens to (a) already-generated derived content citing it,
(b) any vector-store embeddings derived from its text, and (c) any
outstanding signed URLs (naturally bounded if 2.1's short-expiry
recommendation is followed). This document does not resolve those open
questions; it records that Material deletion is an IP-relevant case of
them, not merely a storage-hygiene one.

---

## 3. Risks the product can REDUCE but not fully prevent

These have a partial technical mitigation, but a sufficiently motivated
actor with otherwise-legitimate access can still get around it. Listed
with what the partial mitigation buys.

### 3.1 A legitimate member exporting/downloading the original file wholesale

**Mechanism**: even with signed URLs and no public bucket access (2.1), a
learner or staff member who is *legitimately* shown a source file (in a
product surface that intentionally offers "view/download the original
material") can save it and redistribute it outside the platform.
**Exposed**: lecturer/institution.
**Reduction available**: whether source files are ever shown *as
downloadable originals* to learners at all is itself a product decision —
see the `SOURCE_VISIBLE` / `LEARNING_ONLY` distinction proposed in §5
below. If a product policy chooses `LEARNING_ONLY` (learners only ever see
derived questions/explanations, never the raw file), this specific risk is
avoided entirely for learners — but a lecturer or authorized staff member
who legitimately needs the original file for administration purposes still
has full access, and nothing prevents them from redistributing it once
downloaded. No technical control changes that.

### 3.2 AI generation leaking short, distinctive verbatim phrases

**Mechanism**: unlike 2.5's large-excerpt case, a *short* but distinctive
phrase (a coined term, a specific example, a memorable turn of phrase)
from source Material may appear verbatim in a generated Question or
explanation without tripping a length/similarity threshold, because short
overlaps are common in legitimate paraphrase too and a threshold tuned to
catch them would also reject large amounts of correct, non-infringing
generated content.
**Exposed**: lecturer/institution (a phrase or example they authored,
reproduced without necessarily being a large-scale leak).
**Reduction available**: the same verification pipeline (2.5) reduces the
*frequency and scale* of this — an explicit "does the explanation
introduce any content not attributable to/supported by the source
excerpt" check (already conceptually required by
`docs/MASTER_SPEC.md` §11's verification questions, for a different
reason — checking the explanation is *supported* by source) has a natural
side effect of also bounding how much of the source's exact wording ends
up reproduced. It cannot be reduced to zero without also rejecting
legitimate, source-grounded explanations, which would defeat the point of
grounding explanations in source material at all.

### 3.3 Screenshots/manual copying by a legitimate, currently-enrolled learner

**Mechanism**: a learner who is shown a Question, explanation, or (under a
future `SOURCE_VISIBLE` policy) original Material screenshots, photographs,
or manually retypes it and shares it outside the platform.
**Exposed**: lecturer/institution.
**Reduction available**: essentially none, technically. Browser-level
protections against screenshotting/copying (disabling right-click,
watermarking, disabling text selection) are well-known to be trivially
defeated (screenshot tools, OS-level screen capture, a second device's
camera) and only degrade the legitimate learner's experience without
meaningfully deterring a determined leak. The only real lever here is
non-technical: honor codes, institutional policy, or watermarking content
per-viewer (e.g. a faint learner-id watermark) so a leaked copy can at
least be traced back to who it came from — a deterrent and forensic tool,
not a preventive one. This is explicitly listed here rather than in §4
only because per-viewer watermarking is a real, implementable technical
mitigation for *traceability*, even though it does not prevent the leak
itself.

### 3.4 Vector/embedding representations enabling partial content reconstruction

**Mechanism**: if source Material is chunked and embedded for RAG-based
retrieval (`docs/MASTER_SPEC.md` §13, not yet built —
`docs/DATABASE.md` §48 marks vector data as not part of the current
required foundation), the embeddings themselves, or a sufficiently
detailed retrieval-and-generation pipeline, could allow an adversarial
party with query access to reconstruct substantial portions of the
original source text through repeated targeted queries, even without ever
being handed the source file directly.
**Exposed**: lecturer/institution.
**Reduction available**: scoping retrieval queries to the same
membership/authorization boundary as the source Material itself (a
learner's Tutor queries should only ever retrieve from Material they are
authorized to learn from) bounds *who* can attempt this, but does not
prevent a legitimate, authorized member from doing so slowly over many
queries. Rate-limiting or logging unusually broad/systematic Tutor query
patterns is a possible detection (not prevention) measure. This is a
reason to treat vector-store introduction as a real IP-architecture
decision when it happens, not just a retrieval-quality one — flagged here,
not designed here (`docs/DATABASE.md` §48 already defers this).

---

## 4. Risks IMPOSSIBLE to prevent once content is shown to a legitimate learner

Stated plainly, without a proposed mitigation, because none exists at the
product/technical layer:

- **Memorization and manual retelling.** Once a learner has genuinely
  studied a Question, explanation, or source excerpt, nothing prevents
  them from writing it out from memory, teaching it to someone else, or
  discussing it outside the platform. This is, in fact, the entire point
  of a *learning* product — the content is designed to be internalized.
- **Photographing a screen.** No software-level control (DRM, disabled
  screenshots, watermarking) prevents a second device's camera from
  capturing displayed content. This is a fundamental limit of any
  web-based content delivery, not specific to UNLOCK's architecture.
- **Collusion by a legitimate member.** A currently-enrolled, fully
  authorized learner who chooses to share their legitimate access
  (screen-sharing a live session, or simply relaying answers/content
  verbally to a non-member) cannot be technically distinguished from
  ordinary legitimate use at the point of access — only downstream
  behavioral signals (e.g. implausible simultaneous access patterns) could
  even hint at this, and that is an account-sharing/fraud problem, not an
  IP-protection one.
- **Re-derivation by a knowledgeable third party.** If the underlying
  subject matter is not itself secret (e.g. standard course material on a
  well-known topic), a third party with independent subject-matter
  expertise could produce substantially similar questions/explanations
  without ever accessing UNLOCK's copy at all. UNLOCK's access controls
  protect *this specific instance* of the content, not the underlying
  ideas — this is a general limitation of copyright/IP protection for
  educational material, not something particular to this product.

**UNLOCK's IP posture, stated plainly**: the product's controls (§2) exist
to prevent *unauthorized* access — someone who was never supposed to see
the content in the first place. They do not, and cannot, prevent a
*legitimately authorized* viewer from doing whatever a human can do with
information they have genuinely seen and understood. Any lecturer/
institutional agreement onboarding content into UNLOCK should be set up
with this limitation understood up front, not discovered after an
incident.

---

## 5. Proposed future Material visibility tiers (PROPOSAL — not accepted schema, not an ADR, not implemented)

The following is a **proposal for future product/schema design**,
introduced here because this threat model repeatedly needs to distinguish
"the original file" from "content derived from it," and no such
distinction currently exists in `docs/DATABASE.md`'s conceptual Material
model. This is not a decision, not a committed schema, and not something
this document is authorized to finalize — it exists to give the eventual
Material/authorization design a concrete starting vocabulary.

Proposed conceptual tiers for a Material's visibility policy:

- **`SOURCE_VISIBLE`** — the original uploaded file itself is viewable/
  downloadable by Course members (current default assumption in
  `docs/DATABASE.md` §6's conceptual model, which does not yet distinguish
  tiers at all). Appropriate for lecturer-shared reading material intended
  to be directly distributed to students.
- **`LEARNING_ONLY`** — Course members can interact with content
  *derived* from the Material (generated Questions, Tutor answers grounded
  in it) but never view or download the original file itself. Appropriate
  for lecturer material the lecturer wants used for question generation
  but not redistributed verbatim (e.g. a proprietary problem set, a draft
  chapter). This directly closes §3.1's risk for the learner population,
  though not for staff who administer the Material.
- **`STAFF_ONLY`** — visible only to the lecturer/course-management role
  that owns it and any staff explicitly granted administrative access; not
  used for learner-facing generation at all. Appropriate for material
  under legal/licensing restriction the lecturer is not yet ready to use
  in any learner-facing form.

Open questions this proposal does **not** resolve (left for whoever
eventually designs this): whether tiers are per-Material or inheritable
from a Course-level default; whether a tier can be changed after learners
have already generated derived content from it (an ADR-009-style
versioning question, analogous to Question content versioning); whether
`LEARNING_ONLY` needs to further restrict *how much* of the source an
explanation may quote, beyond the §2.5 similarity-threshold idea.

---

## 6. Summary table

| Risk | Category | Primary control / limitation |
|---|---|---|
| Public/guessable storage URLs | Mitigable | Private bucket + short-lived signed URLs |
| Service-role key leakage | Mitigable | Server-only credential discipline |
| Overly permissive RLS on Material | Mitigable | Membership-scoped policies, tested |
| Access surviving revocation/archival | Mitigable | Re-check membership on every signed-URL mint |
| Large verbatim excerpts in generated content | Mitigable | Similarity-threshold gate in verification pipeline |
| AI provider data retention | Mitigable | Provider selection / data-processing agreement |
| Over-broad staff/admin access | Mitigable | Scoped admin roles, audited exceptional access |
| Source text retained in logs/backups | Mitigable | Metadata-only logging by default |
| Deleted Material remaining accessible | Mitigable | Deletion design accounts for derived content/embeddings/URLs |
| Legitimate member downloading original wholesale | Reducible | `LEARNING_ONLY` tier avoids exposure to learners specifically |
| Short distinctive-phrase leakage in generation | Reducible | Verification pipeline's source-support check |
| Screenshots/manual copying by a member | Reducible (traceability only) | Per-viewer watermarking as deterrent/forensic tool |
| Vector-store partial reconstruction | Reducible | Scope retrieval to authorization boundary; not yet built |
| Memorization / manual retelling | Impossible | None — inherent to learning |
| Photographing a screen | Impossible | None — inherent to any display |
| Collusion by a legitimate member | Impossible | None (behavioral fraud signals only, out of scope here) |
| Independent re-derivation of non-secret ideas | Impossible | None — general IP limitation |

---

## Related documents

- `docs/COURSE_ACCESS_MODEL_DRAFT.md` — membership/authorization model this
  document assumes.
- `docs/DATABASE.md` §6 (Material), §29 (RLS), §37/§38 (deletion/archiving),
  §48 (vector data).
- `docs/MASTER_SPEC.md` §9–§11 (AI generation/verification pipeline), §13
  (RAG/retrieval), §51–§54 (secrets, RLS, data ownership, privacy/deletion).
- `docs/ARCHITECTURE.md` §17–§19 (AI architecture/provider boundaries),
  §31–§32 (security architecture, data ownership).
- `docs/DECISIONS/013-supabase-postgresql-as-v1-persistence-provider.md`
  (current RLS posture: enabled, zero policies).
- `docs/OPEN_QUESTIONS.md` #1 (User↔Course authorization), #27/#28
  (deletion/retirement semantics), #39 (pilot content ownership).
