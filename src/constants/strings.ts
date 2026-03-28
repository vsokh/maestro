// ============================================================
// Centralized UI strings for Dev Manager
// Organized by component / area for easy lookup
// ============================================================

// -- General / Shared --
export const APP_NAME = 'Dev Manager';

// -- Project Picker --
export const PROJECT_PICKER_TITLE = 'Dev Manager';
export const PROJECT_PICKER_SUBTITLE = 'Connecting to bridge server...';
export const PROJECT_PICKER_CONNECT = 'Retry connection';
export const PROJECT_PICKER_ERROR = 'Could not connect to bridge server at localhost:4545. Make sure the server is running.';

// -- Template Picker --
export const TEMPLATE_PICKER_TITLE = 'Choose a template';
export const TEMPLATE_PICKER_SUBTITLE = 'Start with pre-configured skills and agents, or begin with a blank project';
export const TEMPLATE_PICKER_BLANK = 'Blank Project';
export const TEMPLATE_PICKER_BLANK_DESC = 'Start from scratch with just the orchestrator skill';
export const TEMPLATE_PICKER_BACK = 'Back';
export const TEMPLATE_PICKER_DETAILS = 'Details';
export const TEMPLATE_PICKER_LESS = 'Less';
export const TEMPLATE_PICKER_EPICS_LABEL = 'Starter epics';
export const TEMPLATE_PICKER_AGENTS_LABEL = 'Agents';
export const TEMPLATE_PICKER_TASKS_LABEL = 'Default tasks';
export const TEMPLATE_PICKER_SCAFFOLD_LABEL = 'Scaffold';

// -- Header --
export const HEADER_DISCONNECT_ARIA = 'Disconnect project';
export const HEADER_SWITCH_PROJECT = 'Switch project';
export const HEADER_SYNCED = 'Synced from Claude!';
export const HEADER_SYNC_ERROR = 'Sync error';
export const HEADER_CONNECTED = 'Connected';
export const HEADER_TOGGLE_THEME_ARIA = 'Toggle theme';
export const HEADER_LIGHT_MODE = 'Light mode';
export const HEADER_DARK_MODE = 'Dark mode';
export const HEADER_ENGINE_ARIA = 'Default engine';
export const HEADER_ENGINE_TITLE = 'Default engine for new tasks';

// -- Tab Bar (App.tsx) --
export const TAB_BOARD = 'Board';
export const TAB_QUALITY = 'Quality';

// -- Task Board --
export const BOARD_UP_NEXT = 'Up next';
export const BOARD_NO_TASKS = 'No tasks yet';
export const BOARD_NO_MATCHING = 'No matching tasks';
export const BOARD_ADD_TASK = '+ Add task';
export const BOARD_ARRANGE = 'Arrange tasks';
// BOARD_QUEUE_ALL is dynamic: `Queue all (${count})`

// -- Status Filter --
export const FILTER_ALL = 'All';
export const FILTER_PENDING = 'Pending';
export const FILTER_IN_PROGRESS = 'In Progress';
export const FILTER_BLOCKED = 'Blocked';
export const FILTER_PAUSED = 'Paused';
export const FILTER_SEARCH_PLACEHOLDER = 'Search tasks...';

// -- Task Card --
export const CARD_MANUAL_TITLE = 'Manual task';
export const CARD_PAUSE_TITLE = 'Pause \u2014 save progress, resume later';
export const CARD_CANCEL_TITLE = 'Cancel \u2014 discard progress, reset to pending';
export const CARD_PAUSE_ARIA = 'Pause task';
export const CARD_CANCEL_ARIA = 'Cancel task';

// -- Epic Group --
export const EPIC_RENAME_TITLE = 'Click to rename epic';
export const EPIC_DELETE_TITLE = 'Delete epic and all tasks';
export const EPIC_CONFIRM_DELETE = 'Delete epic?';
// EPIC_QUEUE_TITLE is dynamic: `Queue ${count} task(s) from ${group}`
// EPIC_QUEUE_LABEL is dynamic: `Queue ${count}`

// -- Done Section --
export const SECTION_BACKLOG = 'Backlog';
export const SECTION_DONE = 'Done';

// -- Task Detail --
export const DETAIL_EMPTY = 'Click a task to see details';
export const DETAIL_STATUS_ARIA = 'Task status';
export const DETAIL_ENGINE_LABEL = 'Engine';
export const DETAIL_ENGINE_DEFAULT = 'Default';
export const DETAIL_PASTED = 'Pasted!';
export const DETAIL_BLOCKED_PLACEHOLDER = 'Why is this blocked?';
export const DETAIL_EDIT_TITLE = 'Click to edit';
export const DETAIL_NEEDS_REVIEW = 'Needs review';
export const DETAIL_REVIEW_HELP = 'Complex or risky \u2014 review plan carefully';
export const DETAIL_AUTO_APPROVE = 'Auto-approve';
export const DETAIL_AUTO_APPROVE_HELP = 'Skip plan \u2014 go straight to implementation';
export const DETAIL_NOTES_MANUAL = 'Steps / Notes';
export const DETAIL_NOTES_CLAUDE = 'Notes for Claude';
export const DETAIL_NOTES_MANUAL_PLACEHOLDER = 'What you need to do...';
export const DETAIL_NOTES_CLAUDE_PLACEHOLDER = 'Instructions for Claude...';
export const DETAIL_ACTIVATE_TOOLTIP = 'Move from backlog to active tasks \u2014 it will appear in Up Next and can be queued';
export const DETAIL_ACTIVATE = 'Activate \u2192';
export const DETAIL_MARK_DONE = 'Mark done \u2713';
export const DETAIL_MOVE_BACKLOG = 'Move to backlog';
export const DETAIL_BACKLOG = 'Backlog';
export const DETAIL_QUEUE = 'Queue \u25B6';
export const DETAIL_CONFIRM_DELETE = 'Confirm delete?';
export const DETAIL_DELETE = 'Delete task';

// -- Timeline --
export const TIMELINE_TITLE = 'Timeline';
export const TIMELINE_CREATED = 'Created';
export const TIMELINE_PENDING = 'Pending';
export const TIMELINE_STARTED = 'Started';
export const TIMELINE_PAUSED = 'Paused';
export const TIMELINE_BLOCKED = 'Blocked';
export const TIMELINE_COMPLETED = 'Completed';
export const TIMELINE_BACKLOG = 'Backlog';

// -- Attachments --
export const ATTACHMENTS_TITLE = 'Screenshots';
export const ATTACHMENTS_PLACEHOLDER = 'Paste or drop screenshots here';
export const ATTACHMENTS_LOADING = 'Loading...';
export const ATTACHMENTS_DELETE_ARIA = 'Remove attachment';
export const ATTACHMENTS_DELETE_TITLE = 'Delete attachment';

// -- Dependencies --
export const DEPS_TITLE = 'Depends on';
export const DEPS_REMOVE_TITLE = 'Click to remove dependency';
export const DEPS_ADD_TITLE = 'Click to add dependency';

// -- Epic Field --
export const EPIC_LABEL = 'Epic';
export const EPIC_PLACEHOLDER = 'None';

// -- Card Form --
export const FORM_TITLE_PLACEHOLDER = 'Task title...';
export const FORM_EPIC_PLACEHOLDER = 'Epic (e.g. Auth, DevToolbar)...';
export const FORM_DESC_PLACEHOLDER = 'Description (what needs to be done)...';
export const FORM_MANUAL_LABEL = 'Manual task';
export const FORM_MANUAL_HELP = '(done by you, not Claude)';
export const FORM_SKILLS_LABEL = 'Skills';
export const FORM_SKILLS_AUTO = 'auto-detected';
export const FORM_SKILLS_FROM_CATEGORY = 'from epic';
export const FORM_SKILLS_PLACEHOLDER = 'Auto-detected from title, or type manually...';
export const FORM_SKILLS_MATCHED = 'matched:';
export const FORM_CANCEL = 'Cancel';
export const FORM_SAVE = 'Save';
export const FORM_ADD_TASK = 'Add task';

// -- Skills Config --
export const SKILLS_TITLE = 'Skill Categories';
export const SKILLS_EMPTY = 'No categories yet. Add one to get started.';
export const SKILLS_ADD = '+ Add category';
export const SKILLS_NAME_PLACEHOLDER = 'Category name (e.g. frontend)';
export const SKILLS_LIST_PLACEHOLDER = 'skill-1, skill-2, skill-3';
export const SKILLS_REMOVE_TITLE = 'Remove category';
export const SKILLS_CLOSE = 'Close';

// -- Command Queue --
export const QUEUE_MANUAL_TITLE = 'Manual task';
export const QUEUE_MANUAL_YOU = 'Manual task (you)';
export const QUEUE_LAUNCH_ARIA = 'Launch task';
export const QUEUE_LAUNCH_RESUME = 'Resume task';
export const QUEUE_LAUNCH_TERMINAL = 'Launch task';
export const QUEUE_LAUNCH_SET_PATH = 'Bridge server not connected';
export const QUEUE_AUTO_APPROVED = 'Auto-approved \u2014 click to require review';
export const QUEUE_CLICK_APPROVE = 'Click to auto-approve';
export const QUEUE_PAUSED_DEFAULT = 'Paused \u2014 click \u25B6 to resume';
export const QUEUE_PAUSE_ARIA = 'Pause task';
export const QUEUE_PAUSE_TITLE = 'Pause \u2014 save progress, resume later';
export const QUEUE_REMOVE_ARIA = 'Remove from queue';
export const QUEUE_REMOVE_TITLE = 'Remove from queue';
export const QUEUE_LAUNCH_ALL = '\u25B6 Launch all';
export const QUEUE_UNAPPROVE_ALL = 'Unapprove all';
export const QUEUE_APPROVE_ALL = '\u2713 Auto-approve all';
export const QUEUE_UNQUEUE_ALL = 'Unqueue all';
export const QUEUE_PARALLEL = 'parallel';
export const QUEUE_LAUNCH_PHASE_TITLE = 'Launch all tasks in this phase';
export const QUEUE_LAUNCH_PHASE = '\u25B6 Launch phase';
export const QUEUE_REMOVE_PHASE_APPROVE = 'Remove auto-approve from phase';
export const QUEUE_PHASE_APPROVE = 'Auto-approve all in phase';
export const QUEUE_AUTO_LABEL = '\u2713 Auto';
export const QUEUE_EMPTY = 'Queue tasks from the detail panel, then launch each in its own terminal.';
export const QUEUE_PATH_PLACEHOLDER = 'C:\\Users\\you\\Projects\\my-project';
export const QUEUE_SAVE = 'Save';
export const QUEUE_CANCEL = 'Cancel';
export const QUEUE_SET_PATH = 'Set project path to enable launch';
export const QUEUE_EDIT = 'edit';

// -- Output Viewer --
export const OUTPUT_NO_OUTPUT = 'No output yet \u2014 launch the task to see live output here.';
export const OUTPUT_CLEAR = 'Clear';
export const OUTPUT_RUNNING = 'running';
export const OUTPUT_EXITED = 'exited';
export const OUTPUT_EXITED_ERROR = 'exited with error';
export const OUTPUT_STDERR_LABEL = 'err';

// -- Activity Feed --
export const ACTIVITY_EMPTY = 'No activity yet';
export const ACTIVITY_REMOVE_ARIA = 'Remove activity';
export const ACTIVITY_REMOVE_TITLE = 'Remove';

// -- Error Boundary --
export const ERROR_TITLE = 'Something went wrong';
export const ERROR_MESSAGE = 'An unexpected error occurred. You can try reloading or continue from where you left off.';
export const ERROR_TRY_AGAIN = 'Try again';
export const ERROR_RELOAD = 'Reload page';
export const ERROR_DETAILS = 'Error details';

// -- Undo Toast --
export const UNDO_BUTTON = 'Undo';

// -- Quality Panel --
export const QUALITY_LOADING = 'Loading quality data...';
export const QUALITY_UNAVAILABLE = 'Quality data unavailable';
export const QUALITY_RETRY = 'Retry';
export const QUALITY_NO_DATA = 'No quality data yet.';
export const QUALITY_RADAR = 'Radar';
export const QUALITY_HISTORY = 'Score History';
export const QUALITY_BASELINE = 'baseline';

// -- Quality: Launch Buttons --
export const LAUNCH_HEALTHCHECK_CMD = '/codehealth scan';
export const LAUNCH_HEALTHCHECK = 'Healthcheck';
export const LAUNCH_HEALTHCHECK_ACTIVE = '\u2713 Scanning...';
export const LAUNCH_AUTOFIX_CMD = '/autofix';
export const LAUNCH_AUTOFIX = 'Autofix';
export const LAUNCH_AUTOFIX_ACTIVE = '\u2713 Fixing...';

// -- Quality: Findings --
export const FINDINGS_TITLE = 'Top Findings';

// -- Quality: Scorecard --
export const SCORECARD_HEADERS = ['Dimension', 'Score', '', 'Weight', 'Issues', ''];
export const SCORECARD_CLEAN = 'Clean';
// SCORECARD_ISSUES is dynamic: `${count} issues`

// -- Release Panel --
export const TAB_RELEASE = 'Release';
export const RELEASE_LOADING = 'Loading release data...';
export const RELEASE_UNAVAILABLE = 'Release data unavailable';
export const RELEASE_RETRY = 'Retry';
export const RELEASE_NO_DATA = 'No releases yet. Run /release status to assess release readiness.';
export const RELEASE_HISTORY_TITLE = 'Release History';
export const RELEASE_STABILITY_TITLE = 'Stability Breakdown';
export const RELEASE_CHANGELOG_TITLE = 'Changelog';
