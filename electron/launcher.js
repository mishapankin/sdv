const workspaceList = document.querySelector("#workspace-list");
const openWorkspaceButton = document.querySelector("#open-workspace");
const desktopMenuBar = document.querySelector("#desktop-menu-bar");
const desktopWindowControls = document.querySelector(
  "#desktop-window-controls",
);

function renderWindowControls(mode) {
  if (mode !== "left" && mode !== "right") return;

  desktopWindowControls.classList.add(`desktop-window-controls--${mode}`);
  if (mode === "left") {
    desktopMenuBar
      .querySelector(".desktop-menu-bar__menus")
      .classList.add("desktop-menu-bar__menus--controls-left");
  }

  [
    ["minimize", "Minimize window", "−"],
    ["maximize", "Maximize or restore window", "□"],
    ["close", "Close window", "×"],
  ].forEach(([action, label, symbol]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `desktop-window-controls__${action}`;
    button.setAttribute("aria-label", label);
    button.textContent = symbol;
    button.addEventListener("click", () => {
      void window.sdvDesktop.windowAction(action);
    });
    desktopWindowControls.append(button);
  });
}

if (window.sdvDesktop && window.sdvDesktop.platform !== "darwin") {
  document.documentElement.style.setProperty(
    "--desktop-titlebar-height",
    "32px",
  );
  desktopMenuBar.hidden = false;
  void window.sdvDesktop
    .getWindowControls()
    .then(({ mode }) => renderWindowControls(mode));
  desktopMenuBar.querySelectorAll("[data-menu]").forEach((button) => {
    button.addEventListener("click", () => {
      const bounds = button.getBoundingClientRect();
      void window.sdvDesktop.showMenu(button.dataset.menu, {
        x: bounds.left,
        y: bounds.bottom,
      });
    });
  });
}

function formatLastOpened(value) {
  if (!value) return "Previously opened";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Previously opened";

  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();

  return isToday
    ? `Today at ${new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(date)}`
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
      }).format(date);
}

function createWorkspaceRow(repository) {
  const row = document.createElement("article");
  row.className = "workspace-row";
  if (!repository.available) row.classList.add("workspace-row--unavailable");

  const openButton = document.createElement("button");
  openButton.className = "workspace-row__open";
  openButton.type = "button";
  openButton.disabled = !repository.available;

  const status = document.createElement("span");
  status.className = "workspace-row__status";
  status.setAttribute("aria-hidden", "true");

  const details = document.createElement("span");
  details.className = "workspace-row__details";

  const heading = document.createElement("strong");
  heading.textContent = repository.name || repository.path;

  const repositoryPath = document.createElement("span");
  repositoryPath.className = "workspace-row__path";
  repositoryPath.textContent = repository.path;

  const meta = document.createElement("span");
  meta.className = "workspace-row__meta";
  meta.textContent = repository.available
    ? formatLastOpened(repository.lastOpenedAt)
    : "Folder is no longer available";

  details.append(heading, repositoryPath, meta);
  openButton.append(status, details);

  if (repository.available) {
    const arrow = document.createElement("span");
    arrow.className = "workspace-row__arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";
    openButton.append(arrow);
    openButton.addEventListener("click", async () => {
      openButton.disabled = true;
      row.classList.add("workspace-row--opening");
      const result =
        await window.sdvDesktop.openRecentRepository(repository.path);

      if (!result.ok) {
        openButton.disabled = false;
        row.classList.remove("workspace-row--opening");
      }
    });
  }

  const forgetButton = document.createElement("button");
  forgetButton.className = "workspace-row__forget";
  forgetButton.type = "button";
  forgetButton.textContent = "Remove";
  forgetButton.setAttribute(
    "aria-label",
    `Remove ${repository.name || repository.path} from recent workspaces`,
  );
  forgetButton.addEventListener("click", async () => {
    forgetButton.disabled = true;
    await window.sdvDesktop.forgetRepository(repository.path);
    row.remove();

    if (!workspaceList.children.length) {
      renderEmptyState();
    }
  });

  row.append(openButton, forgetButton);
  return row;
}

function renderEmptyState() {
  workspaceList.replaceChildren();

  const empty = document.createElement("div");
  empty.className = "empty-state";

  const copy = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = "No recent workspaces";
  const body = document.createElement("p");
  body.textContent = "Open a Git repository to start your workspace history.";
  copy.append(heading, body);

  empty.append(copy);
  workspaceList.append(empty);
}

async function loadRecentRepositories() {
  try {
    const repositories = await window.sdvDesktop.getRecentRepositories();
    workspaceList.replaceChildren(
      ...repositories.map(createWorkspaceRow),
    );

    if (!repositories.length) renderEmptyState();
  } catch (error) {
    workspaceList.textContent = `Unable to read recent workspaces: ${error.message}`;
  } finally {
    workspaceList.setAttribute("aria-busy", "false");
  }
}

openWorkspaceButton.addEventListener("click", async () => {
  openWorkspaceButton.disabled = true;

  try {
    await window.sdvDesktop.openRepository();
  } finally {
    openWorkspaceButton.disabled = false;
  }
});

if (window.sdvDesktop) {
  void loadRecentRepositories();
} else {
  workspaceList.setAttribute("aria-busy", "false");
  renderEmptyState();
}
