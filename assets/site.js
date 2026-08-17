const navigationToggle = document.querySelector(".nav-toggle");
const navigationMenu = document.querySelector(".nav-menu");

if (navigationToggle && navigationMenu) {
    const closeNavigation = () => {
        navigationMenu.classList.remove("is-open");
        navigationToggle.setAttribute("aria-expanded", "false");
        navigationToggle.setAttribute("aria-label", "Open navigation menu");
    };

    navigationToggle.addEventListener("click", () => {
        const isOpen = navigationMenu.classList.toggle("is-open");
        navigationToggle.setAttribute("aria-expanded", String(isOpen));
        navigationToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
    });

    navigationMenu.addEventListener("click", (event) => {
        if (event.target.closest("a")) closeNavigation();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && navigationMenu.classList.contains("is-open")) {
            closeNavigation();
            navigationToggle.focus();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 980) closeNavigation();
    });
}

document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = String(new Date().getFullYear());
});

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

if (finePointer && !reducedMotion) {
    const cursor = document.createElement("span");
    const cursorRing = document.createElement("span");
    cursor.id = "cursor";
    cursorRing.id = "cursor-ring";
    cursor.setAttribute("aria-hidden", "true");
    cursorRing.setAttribute("aria-hidden", "true");
    document.body.append(cursor, cursorRing);
    document.body.classList.add("has-custom-cursor");

    let mouseX = -100;
    let mouseY = -100;
    let ringX = -100;
    let ringY = -100;

    document.addEventListener("mousemove", (event) => {
        mouseX = event.clientX;
        mouseY = event.clientY;
        document.body.classList.add("cursor-ready");
        cursor.style.transform = `translate(${mouseX}px, ${mouseY}px) translate(-50%, -50%)`;
    });

    document.addEventListener("pointerover", (event) => {
        document.body.classList.toggle(
            "cursor-active",
            Boolean(event.target.closest("a, button, input, textarea, label")),
        );
    });

    const animateCursorRing = () => {
        ringX += (mouseX - ringX) * 0.16;
        ringY += (mouseY - ringY) * 0.16;
        cursorRing.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
        window.requestAnimationFrame(animateCursorRing);
    };
    animateCursorRing();
}

const revealElements = document.querySelectorAll(
    ".section-header, .card, .capability-card, .project-card, .role-summary, .credential-card, .timeline-item, .page-feature-media, .profile-media, .prose, .contact-card, .cta-panel",
);

revealElements.forEach((element) => element.classList.add("reveal"));

if (reducedMotion || !("IntersectionObserver" in window)) {
    revealElements.forEach((element) => element.classList.add("is-visible"));
} else {
    const revealObserver = new IntersectionObserver(
        (entries, observer) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("is-visible");
                observer.unobserve(entry.target);
            });
        },
        { threshold: 0.12, rootMargin: "0px 0px -6%" },
    );

    revealElements.forEach((element) => revealObserver.observe(element));
}

const contactForm = document.querySelector("#contact-form");

if (contactForm) {
    const statusMessage = contactForm.querySelector(".form-status");
    const fields = {
        name: contactForm.elements.name,
        email: contactForm.elements.email,
        message: contactForm.elements.message,
        consent: contactForm.elements["privacy-consent"],
    };

    const setFieldError = (name, message) => {
        const field = fields[name];
        const error = contactForm.querySelector(`[data-error-for="${name}"]`);
        field.setAttribute("aria-invalid", message ? "true" : "false");
        if (error) error.textContent = message;
    };

    const validateForm = () => {
        const name = fields.name.value.trim();
        const email = fields.email.value.trim();
        const message = fields.message.value.trim();

        setFieldError("name", name.length >= 2 ? "" : "Please enter your name.");
        setFieldError(
            "email",
            /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? "" : "Please enter a valid email address.",
        );
        setFieldError("message", message.length >= 10 ? "" : "Please add at least 10 characters.");
        setFieldError("consent", fields.consent.checked ? "" : "Please confirm the privacy consent.");

        return !contactForm.querySelector('[aria-invalid="true"]');
    };

    Object.entries(fields).forEach(([name, field]) => {
        const eventName = field.type === "checkbox" ? "change" : "input";
        field.addEventListener(eventName, () => setFieldError(name, ""));
    });

    contactForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        statusMessage.className = "form-status";
        statusMessage.textContent = "";

        if (!validateForm()) {
            statusMessage.classList.add("is-error");
            statusMessage.textContent = "Please review the highlighted fields.";
            contactForm.querySelector('[aria-invalid="true"]')?.focus();
            return;
        }

        const submitButton = contactForm.querySelector('button[type="submit"]');
        const originalLabel = submitButton.textContent;
        contactForm.setAttribute("aria-busy", "true");
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
        statusMessage.textContent = "Sending your message...";

        try {
            const payload = new FormData(contactForm);
            payload.delete("privacy-consent");
            const response = await fetch("https://formsubmit.co/ajax/okurutmauriceleonard@gmail.com", {
                method: "POST",
                headers: { Accept: "application/json" },
                body: payload,
            });

            if (!response.ok) throw new Error("The message service did not accept the request.");

            contactForm.reset();
            statusMessage.classList.add("is-success");
            statusMessage.textContent = "Thanks. Your message has been sent.";
        } catch (error) {
            statusMessage.classList.add("is-error");
            statusMessage.innerHTML =
                'The form could not send your message. Please use <a href="mailto:okurutmauriceleonard@gmail.com">email instead</a>.';
            console.error("[contact form]", error);
        } finally {
            contactForm.removeAttribute("aria-busy");
            submitButton.disabled = false;
            submitButton.textContent = originalLabel;
        }
    });
}
