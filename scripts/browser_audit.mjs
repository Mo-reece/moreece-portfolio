import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

const chromePath = process.env.CHROME_PATH
  ?? String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;
const externalPort = Number(process.env.CHROME_DEBUG_PORT ?? 0);
const profile = resolve(".portfolio-browser-audit");
const suppliedUrl = process.argv[2] ?? "http://127.0.0.1:8000/";
const baseUrl = new URL("./", suppliedUrl).href;
const routes = [
  "index.html",
  "about.html",
  "experience.html",
  "services.html",
    "projects.html",
    "contact.html",
    "privacy.html",
    "404.html",
  "services/solutions-architecture.html",
  "services/full-stack-development.html",
  "services/data-engineering.html",
  "services/analytics-reporting.html",
  "services/automation-ai-data.html",
];

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
  ], { stdio: "ignore", windowsHide: true });
}

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
let websocket;

try {
  let pages;
  let pageTarget;
  let port = externalPort || undefined;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      if (!port) {
        const activePort = await readFile(join(profile, "DevToolsActivePort"), "utf8");
        port = Number(activePort.trim().split(String.fromCharCode(10))[0].trim());
      }
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      pages = await response.json();
      pageTarget = pages.find((page) => page.type === "page" && page.webSocketDebuggerUrl);
      if (pageTarget) break;
    } catch {
      // Chrome is still starting.
    }
    await sleep(100);
  }
  if (!pageTarget?.webSocketDebuggerUrl) throw new Error("Chrome DevTools page endpoint did not start");

  websocket = new WebSocket(pageTarget.webSocketDebuggerUrl);
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

  await Promise.all([send("Page.enable"), send("Runtime.enable"), send("Network.enable")]);

  const viewports = [
    { width: 320, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1440, height: 1000 },
  ];
  const results = [];

  for (const route of routes) {
    for (const viewport of viewports) {
      await send("Emulation.setDeviceMetricsOverride", {
        width: viewport.width,
        height: viewport.height,
        deviceScaleFactor: 1,
        mobile: viewport.width < 900,
      });
      const url = new URL(route, baseUrl).href;
      const navigation = await send("Page.navigate", { url });
      if (navigation.errorText) throw new Error(`Could not load ${url}: ${navigation.errorText}`);
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const readiness = await send("Runtime.evaluate", {
          returnByValue: true,
          expression: `({ readyState: document.readyState, url: location.href, hasMain: Boolean(document.querySelector("main")) })`,
        });
        if (readiness.result.value?.readyState === "complete" && readiness.result.value?.hasMain) break;
        await sleep(100);
      }
      await send("Runtime.evaluate", {
        awaitPromise: true,
        returnByValue: true,
        expression: `(async () => {
          await document.fonts.ready;
          const step = Math.max(window.innerHeight * 0.75, 480);
          for (let position = 0; position < document.documentElement.scrollHeight; position += step) {
            window.scrollTo(0, position);
            await new Promise((resolve) => setTimeout(resolve, 45));
          }
          window.scrollTo(0, document.documentElement.scrollHeight);
          await Promise.all([...document.images].map((image) => {
            if (image.complete) return Promise.resolve();
            return new Promise((resolve) => {
              image.addEventListener("load", resolve, { once: true });
              image.addEventListener("error", resolve, { once: true });
              setTimeout(resolve, 4000);
            });
          }));
          window.scrollTo(0, 0);
          await new Promise((resolve) => setTimeout(resolve, 120));
          return true;
        })()`,
      });
      const evaluation = await send("Runtime.evaluate", {
        returnByValue: true,
        expression: `(() => {
          const viewportWidth = window.innerWidth;
          const offenders = [...document.querySelectorAll("body *")]
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
                    const navToggle = document.querySelector(".nav-toggle");
                    const navMenu = document.querySelector(".nav-menu");
                    const main = document.querySelector("main");
                    const smallTargets = [...document.querySelectorAll(".button, .nav-toggle, .nav-menu a")]
                        .filter((element) => {
                            const style = getComputedStyle(element);
                            const rect = element.getBoundingClientRect();
                            return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0;
                        })
                        .map((element) => {
                            const rect = element.getBoundingClientRect();
                            return {
                                label: element.textContent.trim() || element.getAttribute("aria-label"),
                                width: Math.round(rect.width),
                                height: Math.round(rect.height),
                            };
                        })
                        .filter((target) => target.width < 24 || target.height < 24);
                    const externalBlankLinksSafe = [...document.querySelectorAll('a[target="_blank"]')].every((link) => {
                        const rel = new Set(link.rel.split(/\\s+/));
                        return rel.has("noopener") && rel.has("noreferrer");
                    });
                    let mobileMenuFunctional = null;
          if (viewportWidth <= 980 && navToggle && navMenu) {
            navToggle.click();
            mobileMenuFunctional = navMenu.classList.contains("is-open")
              && navToggle.getAttribute("aria-expanded") === "true";
            navToggle.click();
          }
          return {
            title: document.title,
            statusContent: document.body.innerText.trim().length > 100,
                        h1Count: document.querySelectorAll("h1").length,
                        mainPresent: Boolean(main),
                        languagePresent: Boolean(document.documentElement.lang),
                        canonicalCount: document.querySelectorAll('link[rel="canonical"]').length,
                        skipLinkPresent: document.querySelector('.skip-link[href="#main-content"]') !== null,
                        landmarksPresent: Boolean(document.querySelector("header, nav")) && Boolean(document.querySelector("footer")),
                        imagesLoaded: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
                        imageDimensionsPresent: [...document.images].every((image) => image.hasAttribute("width") && image.hasAttribute("height")),
                        fontsReady: document.fonts.status === "loaded",
                        externalBlankLinksSafe,
                        smallTargets,
                        viewport: viewportWidth,
            documentWidth: document.documentElement.scrollWidth,
            hasHorizontalOverflow: document.documentElement.scrollWidth > viewportWidth,
            offenders,
            mobileToggleVisible: navToggle ? getComputedStyle(navToggle).display !== "none" : false,
            mobileMenuFunctional,
          };
        })()`,
      });
      results.push({ route, ...evaluation.result.value });
    }
  }

  const failures = results.filter((result) => (
    result.hasHorizontalOverflow
    || !result.statusContent
        || result.h1Count !== 1
        || !result.mainPresent
        || !result.languagePresent
        || (result.route !== "404.html" && result.canonicalCount !== 1)
        || !result.skipLinkPresent
        || !result.landmarksPresent
        || !result.imagesLoaded
        || !result.imageDimensionsPresent
        || !result.fontsReady
        || !result.externalBlankLinksSafe
        || result.smallTargets.length > 0
        || result.mobileMenuFunctional === false
  ));

  const report = { baseUrl, pagesChecked: routes.length, checks: results.length, browserErrors, failures };
  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ ...report, results }, null, 2));
  } else {
    console.log(`Audited ${routes.length} pages across ${viewports.length} viewports (${results.length} checks).`);
    console.log(`Failures: ${failures.length}; browser errors: ${browserErrors.length}.`);
    if (failures.length || browserErrors.length) {
      console.log(JSON.stringify({ failures, browserErrors }, null, 2));
    }
  }
  if (failures.length || browserErrors.length) process.exitCode = 1;
  await send("Browser.close");
} finally {
  if (websocket?.readyState === WebSocket.OPEN) websocket.close();
  if (chrome && chrome.exitCode === null) {
    chrome.kill();
    await Promise.race([
      new Promise((resolvePromise) => chrome.once("exit", resolvePromise)),
      sleep(2000),
    ]);
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      await rm(profile, { recursive: true, force: true });
      break;
    } catch (error) {
      if (error.code !== "EBUSY" || attempt === 7) throw error;
      await sleep(250);
    }
  }
}
