import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const chromePath = process.env.CHROME_PATH
  ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const externalPort = Number(process.env.CHROME_DEBUG_PORT ?? 0);
const profile = resolve("..", ".portfolio-browser-audit");
const targetUrl = process.argv[2]
  ?? pathToFileURL(resolve("index.html")).href;
const screenshotDirectory = process.env.AUDIT_SCREENSHOT_DIR
  ? resolve(process.env.AUDIT_SCREENSHOT_DIR)
  : undefined;

let chrome;
if (!externalPort) {
  await rm(profile, { recursive: true, force: true });
  await mkdir(profile, { recursive: true });
  chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-allow-origins=*",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ], { stdio: "ignore" });
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
let websocket;

try {
  if (screenshotDirectory) await mkdir(screenshotDirectory, { recursive: true });
  let pages;
  let port = externalPort || undefined;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      if (!port) {
        const activePort = await readFile(join(profile, "DevToolsActivePort"), "utf8");
        port = Number(activePort.trim().split(String.fromCharCode(10))[0].trim());
      }
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      pages = await response.json();
      const page = pages.find((target) =>
        target.type === "page" && !target.url.startsWith("chrome-extension://")
      );
      if (page?.webSocketDebuggerUrl) {
        pages = [page];
        break;
      }
    } catch {
      // Chrome is still starting.
    }
    await sleep(100);
  }
  if (!pages?.[0]?.webSocketDebuggerUrl) throw new Error("Chrome DevTools endpoint did not start");

  websocket = new WebSocket(pages[0].webSocketDebuggerUrl);
  await new Promise((resolvePromise, reject) => {
    websocket.addEventListener("open", resolvePromise, { once: true });
    websocket.addEventListener("error", reject, { once: true });
  });

  let commandId = 0;
  const pending = new Map();
  const browserErrors = [];

  websocket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) {
      const { resolve: resolveCommand, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolveCommand(message.result);
    }
    if (message.method === "Runtime.exceptionThrown") {
      browserErrors.push(message.params.exceptionDetails.text);
    }
    if (message.method === "Network.loadingFailed" && !message.params.canceled) {
      browserErrors.push(`Network failure: ${message.params.errorText}`);
    }
  });

  const send = (method, params = {}) => new Promise((resolveCommand, reject) => {
    const id = ++commandId;
    pending.set(id, { resolve: resolveCommand, reject });
    websocket.send(JSON.stringify({ id, method, params }));
  });

  await Promise.all([
    send("Page.enable"),
    send("Runtime.enable"),
    send("Network.enable"),
  ]);

  const viewports = [
    { width: 320, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1440, height: 1000 },
  ];
  const results = [];

  for (const viewport of viewports) {
    await send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await send("Page.navigate", { url: targetUrl });
    await sleep(2200);
    const evaluation = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const viewportWidth = window.innerWidth;
        const offenders = [...document.querySelectorAll("body *")]
          .filter((element) =>
            !element.closest(".honeypot")
            && !element.closest(".nav-links:not(.is-open)")
          )
          .map((element) => {
            const rect = element.getBoundingClientRect();
            return {
              selector: element.tagName.toLowerCase()
                + (element.id ? "#" + element.id : "")
                + [...element.classList].map((name) => "." + name).join(""),
              left: Math.round(rect.left),
              right: Math.round(rect.right),
              width: Math.round(rect.width),
            };
          })
          .filter((item) => item.width > 0 && (item.left < -1 || item.right > viewportWidth + 1))
          .slice(0, 12);
        const projectActions = document.querySelector(".project-actions");
        const navToggle = document.querySelector(".nav-toggle");
        const brokenImages = [...document.images]
          .filter((image) => image.complete && image.naturalWidth === 0)
          .map((image) => image.currentSrc || image.src);
        return {
          title: document.title,
          currentUrl: location.href,
          viewport: viewportWidth,
          documentWidth: document.documentElement.scrollWidth,
          mobileMediaMatches: window.matchMedia("(max-width: 760px)").matches,
          hasHorizontalOverflow: document.documentElement.scrollWidth > viewportWidth,
          offenders,
          projectActionCount: document.querySelectorAll(".project-actions").length,
          projectActionsVisible: projectActions
            ? getComputedStyle(projectActions).display !== "none"
              && getComputedStyle(projectActions).visibility !== "hidden"
              && projectActions.getBoundingClientRect().width > 0
            : false,
          navToggleExists: Boolean(navToggle),
          mobileToggleVisible: navToggle ? getComputedStyle(navToggle).display !== "none" : false,
          brokenImages,
        };
      })()`,
    });
    results.push(evaluation.result.value);
    if (screenshotDirectory) {
      const screenshot = await send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
      });
      await writeFile(
        join(screenshotDirectory, String(viewport.width) + ".png"),
        Buffer.from(screenshot.data, "base64"),
      );
    }
  }

  console.log(JSON.stringify({ targetUrl, results, browserErrors }, null, 2));
  const hasResponsiveFailure = results.some((result) =>
    result.hasHorizontalOverflow
    || result.brokenImages.length > 0
    || !result.projectActionsVisible
    || result.mobileToggleVisible !== (result.viewport <= 760)
  );
  if (hasResponsiveFailure || browserErrors.length) {
    process.exitCode = 1;
  }
  await send("Browser.close");
  if (chrome) {
    await Promise.race([
      new Promise((resolveExit) => chrome.once("exit", resolveExit)),
      sleep(2000),
    ]);
  }
} finally {
  if (websocket?.readyState === WebSocket.OPEN) websocket.close();
  if (chrome) {
    if (chrome.exitCode === null) chrome.kill();
    await sleep(500);
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
  }
}
