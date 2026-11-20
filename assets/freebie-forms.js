document
  .querySelectorAll(".freebie-form, [data-freebie-action]")
  .forEach((form) => {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector("button"),
        status = form.querySelector('[role="status"]');
      button.disabled = true;
      status.textContent = "One moment…";
      try {
        const data = new FormData(form);
        const body = form.dataset.freebieAction
          ? {
              action: form.dataset.freebieAction,
              token: location.hash.slice(1),
            }
          : {
              resource: form.closest("[data-freebie]").dataset.freebie,
              firstName: data.get("fields[name]"),
              email: data.get("fields[email]"),
              consent: data.get("consent") === "on",
              website: data.get("website"),
            };
        const response = await fetch("/api/freebies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const result = await response.json();
        if (!response.ok)
          throw Error(result.message || "Please try again shortly.");
        if (!form.dataset.freebieAction) location.assign("/freebie-thank-you");
        else {
          status.textContent = result.message;
          button.hidden = true;
          history.replaceState(null, "", location.pathname);
        }
      } catch (error) {
        status.textContent =
          error.message || "We couldn’t connect. Please try again.";
        button.disabled = false;
      }
    });
  });
