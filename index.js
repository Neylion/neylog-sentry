"use strict";

const Sentry = require("@sentry/node");
const Exception = require("../models/exceptions/exceptionBase");

function init(dsn, environment) {
  Sentry.init({
    dsn,
    defaultIntegrations: false,
    environment
  });
}

const defaultOptions = {
  request: ["method", "url", "data", "query_string"]
};
function setupMiddleware(app, options = defaultOptions) {
  app.use(Sentry.Handlers.requestHandler(options));
}

function attemptLog(message, logData) {
  try {
    log(message, logData);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.log("Unexpect error while trying to log to sentry.", err);
  }
}

function log(message, logData) {
  // To avoid duplicated error alerts, make sure that we only capture error on the inbound related logs.
  const captureError = logData.direction !== "OUTBOUND";
  // Adjusting loglevels to align with sentry's.
  const level = logData.level === "warn" ? "warning" : logData.level;

  setTag("callingClient", logData.context.callingClient);
  setTag("correlationId", logData.context.correlationId);
  addBreadcrumb(level, message);
  if ((level === "error" || level === "fatal") && captureError) {
    logData.error = logData.error || new Exception("Missing error object!");
    addErrorObject(logData.error);
    setLevel(level);
    // Make error include our own error message
    logData.error.originalMessage = logData.error.message;
    logData.error.message = message;
    Sentry.captureException(logData.error);
  }
}

function setLevel(level) {
  Sentry.configureScope((scope) => {
    scope.setLevel(level);
  });
}

function addErrorObject(error) {
  Sentry.configureScope((scope) => {
    scope.setExtra("error", error);
  });
}

function addBreadcrumb(level, message) {
  const breadcrumb = {
    level,
    message,
  };

  Sentry.configureScope((scope) => {
    scope.addBreadcrumb(breadcrumb);
  });
}

function setTag(key, value) {
  Sentry.configureScope((scope) => {
    scope.setTag(key, value);
  });
}

module.exports = {
  init,
  setupMiddleware,
  log: attemptLog
};
