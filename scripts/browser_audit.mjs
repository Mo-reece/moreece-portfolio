import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const chromePath = process.env.CHROME_PATH
  ?? "C:\Program Files\Google\Chrome\Application\chrome.exe";
const externalPort = Number(process.env.CHROME_DEBUG_PORT ?? 0);
const profile = resolve("..", ".portfolio-browser-audit");
const targetUrl = process.argv[2]
  ?? pathToFileURL(resolve("index.html")).href;

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
      if (pages[0]?.webSocketDebuggerUrl) break;
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
      mobile: viewport.width < 900,
    });
    await send("Page.navigate", { url: targetUrl });
    await sleep(2200);
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
        const projectLink = document.querySelector(".project-links");
        const navToggle = document.querySelector(".nav-toggle");
        return {
          viewport: viewportWidth,
          documentWidth: document.documentElement.scrollWidth,
          hasHorizontalOverflow: document.documentElement.scrollWidth > viewportWidth,
          offenders,
          projectLinksVisible: projectLink ? getComputedStyle(projectLink).opacity === "1" : false,
          mobileToggleVisible: navToggle ? getComputedStyle(navToggle).display !== "none" : false,
        };
      })()`,
    });
    results.push(evaluation.result.value);
  }

  console.log(JSON.stringify({ targetUrl, results, browserErrors }, null, 2));
  if (results.some((result) => result.hasHorizontalOverflow) || browserErrors.length) {
    process.exitCode = 1;
  }
  await send("Browser.close");
} finally {
  if (websocket?.readyState === WebSocket.OPEN) websocket.close();
  if (chrome) {
    chrome.kill();
    await rm(profile, { recursive: true, force: true });
  }
}
