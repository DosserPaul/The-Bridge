# THE BRIDGE

_See everything. Direct anything._

THE BRIDGE is a personal mission control that keeps freelance project context and local code sources organized without mixing client boundaries.

## Language

**Client**:
A person or organization for whom work is performed. A project may exist without a client when it is personal.
_Avoid_: Customer, account, personal client

**Project**:
The primary unit of work and context in THE BRIDGE. A project may group several repositories and may optionally belong to a client.
_Avoid_: Workspace, repository

**Repository**:
A local Git source attached to a project. Its canonical local path identifies it across THE BRIDGE.
_Avoid_: Project, codebase

**Repository state**:
The latest observed Git facts for a repository, such as its branch, head commit, and working-tree changes.
_Avoid_: Repository status

**Provider connection**:
A validated link between THE BRIDGE and a source-code provider instance. Its public account metadata lives in SQLite while its credential stays in the operating-system keychain.
_Avoid_: Stored token, GitLab account

**Pipeline**:
A provider-originated continuous-integration run normalized by THE BRIDGE into a common status, ref, commit, URL, and timestamps.
_Avoid_: Local run, agent run

**Personal project**:
A project that is not attached to a client.
_Avoid_: Personal client

**Agent**:
A reusable autonomous worker profile with a role, instructions, capabilities, and a default runtime profile. An agent may work independently or occupy one or more positions in agent teams.
_Avoid_: Bot, assistant, sub-agent

**Agent team**:
A hierarchical organization of agent assignments that collaborates on missions under a designated lead. Teams may contain both individual contributors and leads with their own reports.
_Avoid_: Multi-agent, agent group, swarm

**Agent assignment**:
An agent’s position inside an agent team, including its role and reporting line. Being subordinate is contextual to an assignment and does not define a separate kind of agent.
_Avoid_: Sub-agent, child agent

**Runtime profile**:
The provider, model, service tier, reasoning level, limits, and fallback policy used to execute an agent. It is a replaceable policy rather than part of the agent’s identity.
_Avoid_: Agent model, hard-coded model

**Mission**:
A bounded objective assigned to a person, agent, or agent team. A mission may be decomposed into delegated missions while retaining a single traceable outcome.
_Avoid_: Prompt, agent task

**Agent run**:
A single execution attempt for a mission, including its runtime profile, delegation tree, approvals, activity, and outcome.
_Avoid_: Pipeline, chat, session
