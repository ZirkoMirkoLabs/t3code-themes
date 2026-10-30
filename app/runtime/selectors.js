/* T3 DOM selector map: the ONE place that knows T3's markup.
 * Checked against the live T3 Code 0.1.6 client (2026-10-30). If T3 changes and a `required` hook stops matching,
 * the engine falls back to tokens only (colours/fonts, no transparent panels, no scene behind text). */
(function () {
  'use strict';
  window.T3SkinSelectors = {
    checkedAgainst: 'T3 Code 0.1.6-nightly.20261030.3904',
    // Layout hooks. `required` ones decide whether the full skin (transparent surfaces + scene) is safe.
    layout: {
      root: { sel: '#root', required: false },
      sidebarWrapper: { sel: "[data-slot='sidebar-wrapper']", required: true },
      sidebar: { sel: "[data-slot='sidebar']", required: false },
      sidebarContainer: { sel: "[data-slot='sidebar-container']", required: false },
      sidebarInner: { sel: "[data-slot='sidebar-inner']", required: false },
      sidebarPalette: { sel: '[data-app-sidebar]', required: false },
      sidebarFooter: { sel: "[data-slot='sidebar-footer']", required: false },
      sidebarShelf: { sel: "[data-sidebar-row='shelf:snoozed'], [data-sidebar-row='shelf:settled']", required: false },
      // No data hook on the status label yet. Match the observed class token, not its text/timer.
      statusChip: { sel: "[data-thread-item] [class~='group/sidebar-status-slot'] > span:first-child > span", required: false },
      workingChip: { sel: "[data-thread-item] [class~='group/sidebar-status-slot'] > span:first-child > span:has(svg.lucide-circle-dashed)", required: false },
      sidebarStage: { sel: '.sidebar-stage-backdrop', required: false },
      sidebarBrand: { sel: ':has(> .sidebar-stage-backdrop)', required: false }, // brand row drawn white for T3's own stage art
      inset: { sel: "[data-slot='sidebar-inset']", required: true },
      header: { sel: '[data-chat-header]', required: false },
      headerControls: { sel: '[data-workspace-titlebar-controls], [data-panel-layout-controls]', required: false },
      headerButton: { sel: '[data-workspace-titlebar-controls] button, [data-panel-layout-controls] button', required: false },
      chatColumn: { sel: '[data-chat-column]', required: false },
      chatCanvas: { sel: '[data-chat-canvas]', required: false },
      dropTarget: { sel: '[data-chat-workspace-drop-target]', required: false },
      composer: { sel: "[data-slot='composer-shell']", required: false },
      composerSurface: { sel: "[data-chat-composer-main-surface='true']", required: false },
      composerBody: { sel: '[data-chat-composer-body]', required: false },
      composerFooter: { sel: '[data-chat-composer-footer]', required: false },
      composerControls: { sel: '[data-chat-composer-controls]', required: false },
      composerModel: { sel: '[data-chat-provider-model-picker]', required: false },
      composerContext: { sel: "[data-slot='composer-context-strip']", required: false },
      composerPermission: { sel: '[data-composer-context-control]', required: false },
      composerEditor: { sel: "[data-testid='composer-editor'], [data-slot='composer-shell'] textarea", required: false },
      composerAction: { sel: ":is([data-slot='composer-shell'], [data-chat-composer-transition-actions='true']) button:is([type='submit'], [aria-label='Resume thread'], [aria-label='Implementation actions'])", required: false },
      timelineRow: { sel: '[data-timeline-row-id]', required: false },
      details: { sel: '[data-thread-details-panel]', required: false },
      welcomeHeading: { sel: ":is(h1:has([data-draft-project-trigger]), [class~='group/draft-hero'] > h1)", required: false },
      projectTrigger: { sel: '[data-draft-project-trigger]', required: false },
      markdown: { sel: '.chat-markdown', required: false },
      codeblock: { sel: '.chat-markdown pre, .chat-markdown-codeblock', required: false },
      threadItem: { sel: '[data-thread-item]', required: false },
      threadRow: { sel: "[data-thread-item] :is([data-sidebar-row], [role='button'])", required: false },
      activeThread: { sel: "[data-thread-item] :is([data-sidebar-row], [role='button']):is([aria-current='page'], [aria-current='true'], [aria-selected='true'])", required: false },
      menuButton: { sel: "[data-sidebar='menu-button'], [data-slot='sidebar-menu-button']", required: false },
      button: { sel: "button[data-slot='button'], [data-slot='toggle']", required: false }
    },
    // Opaque-by-design wrappers the skin makes transparent so the scene shows through.
    transparent: [
      '#root', "[data-slot='sidebar-wrapper']", "[data-slot='sidebar-inset']",
      'div.bg-background:has(> [data-chat-column])',
      '[data-chat-workspace-drop-target] > div.bg-background',
      '[data-chat-workspace-drop-target] > div > div.bg-background',
      '[data-chat-header]'
    ],
    // Text regions measured live and sent to the scene as safe zones (scene keeps calm there,
    // runtime adds a scrim). `area` zones are derived in engine.js (message lane, welcome hero).
    zones: {
      sidebar: "[data-slot='sidebar-container'], [data-slot='sidebar'][data-mobile='true']",
      topbar: '[data-chat-header]',
      composer: "[data-slot='composer-shell']",
      details: '[data-thread-details-panel]',
      hero: ":is(h1:has([data-draft-project-trigger]), [class~='group/draft-hero'] > h1)",
      controls: '[data-workspace-titlebar-controls], [data-panel-layout-controls]',
      context: "[data-slot='composer-context-strip']",
      shelf: "[data-sidebar-row='shelf:snoozed'], [data-sidebar-row='shelf:settled']",
      status: "[data-thread-item] [class~='group/sidebar-status-slot'] > span:first-child > span"
    },
    // The floating "Fri 30" daily card seen on Windows is a separate Floatie window,
    // not T3 DOM (verified by native window capture and CDP on 2026-10-30).
    // Do not invent a selector for it or expose OS window/chat content to scene workers.
    // Lucide icon names T3 uses -> CSS selector. Themes may restyle or replace these.
    icons: {
      settings: 'svg.lucide-settings', search: 'svg.lucide-search', filter: 'svg.lucide-list-filter',
      'folder-plus': 'svg.lucide-folder-plus', 'new-thread': 'svg.lucide-square-pen', folder: 'svg.lucide-folder',
      plus: 'svg.lucide-plus', clip: 'svg.lucide-paperclip', brain: 'svg.lucide-brain', server: 'svg.lucide-server',
      branch: 'svg.lucide-git-branch-plus', 'pull-request': 'svg.lucide-git-pull-request-arrow',
      stats: 'svg.lucide-chart-no-axes-column', menu: 'svg.lucide-square-menu', ellipsis: 'svg.lucide-ellipsis',
      'panel-bottom': 'svg.lucide-panel-bottom', 'panel-right': 'svg.lucide-panel-right', clock: 'svg.lucide-clock',
      check: 'svg.lucide-check', chevron: 'svg.lucide-chevron-down', lock: 'svg.lucide-lock-open, svg.lucide-lock'
    },
    // Working / loading indicators.
    loaders: 'svg.lucide-circle-dashed, svg.lucide-loader, svg.lucide-loader-circle, svg.animate-spin',
    // Things the scene must never cover or restyle (menus/dialogs keep their own opaque surfaces).
    overlays: "[data-base-ui-portal], [role='dialog'], [role='menu'], [role='listbox']"
  };
})();
