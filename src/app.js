import React from "react";
import { HashRouter, Route, Switch, useLocation } from "react-router-dom";
import { TransitionGroup, CSSTransition } from "react-transition-group";

import { SWRConfig } from "swr";

import { SearchView } from "./views/search-view";
import { SettingsView } from "./views/settings-view";
import { JsonConfigView } from "./views/json-config-view";
import ErrorBoundary from "./components/error-boundary";
import { ExternalLink } from "./components/external-link";

const swrConfig = {
  refreshInterval: 0,
  revalidateOnFocus: false,
  fetcher: async function (url) {
    const res = await fetch(url, { credentials: "omit" });
    return res.json();
  },
};

function AppBody({ store }) {
  const location = useLocation();

  return (
    <TransitionGroup enter={location.pathname !== "/"} exit={location.pathname === "/"}>
      <CSSTransition key={location.pathname} classNames="fade" timeout={300}>
        <Switch location={location}>
          <Route path="/settings">
            <SettingsView store={store} />
          </Route>
          <Route path="/json-config">
            <JsonConfigView store={store} />
          </Route>
          <Route path="/">
            <SearchView store={store} />
          </Route>
        </Switch>
      </CSSTransition>
    </TransitionGroup>
  );
}

function App({ store }) {
  return (
    <SWRConfig value={swrConfig}>
      <HashRouter>
        <ErrorBoundary
          displayStacktrace
          message={
            <div>
              <ExternalLink href="https://github.com/hverlin/Quest/issues">
                Report an issue on Github
              </ExternalLink>
            </div>
          }
        >
          <AppBody store={store} />
        </ErrorBoundary>
      </HashRouter>
    </SWRConfig>
  );
}

export default App;
