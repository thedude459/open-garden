import { BrowserRouter } from "react-router-dom";
import { useState } from "react";
import { useAuthFlow } from "./features/app/hooks/useAuthFlow";
import { useAuthedFetch } from "./features/app/hooks/useAuthedFetch";
import { useNotices } from "./features/app/hooks/useNotices";
import { AuthScreen } from "./features/auth/AuthScreen";
import { AuthenticatedApp } from "./AuthenticatedApp";

function App() {
  const [token, setToken] = useState<string>(localStorage.getItem("open-garden-token") || "");

  const { notices, dismissNotice, pushNotice } = useNotices();
  const { authHeaders, fetchAuthed } = useAuthedFetch(token, setToken);
  const authFlow = useAuthFlow({ setToken, authHeaders, pushNotice });

  if (!token) {
    return (
      <AuthScreen
        email={authFlow.email}
        setEmail={authFlow.setEmail}
        username={authFlow.username}
        setUsername={authFlow.setUsername}
        password={authFlow.password}
        setPassword={authFlow.setPassword}
        loginMode={authFlow.loginMode}
        setLoginMode={authFlow.setLoginMode}
        authPane={authFlow.authPane}
        setAuthPane={authFlow.setAuthPane}
        setResetToken={authFlow.setResetToken}
        resetPassword={authFlow.resetPassword}
        setResetPassword={authFlow.setResetPassword}
        handleAuth={authFlow.handleAuth}
        handleForgotPassword={authFlow.handleForgotPassword}
        handleForgotUsername={authFlow.handleForgotUsername}
        submitPasswordReset={authFlow.submitPasswordReset}
        notices={notices}
        dismissNotice={dismissNotice}
      />
    );
  }

  return (
    <BrowserRouter>
      <AuthenticatedApp
        token={token}
        setToken={setToken}
        pushNotice={pushNotice}
        fetchAuthed={fetchAuthed}
        authFlow={authFlow}
        notices={notices}
        dismissNotice={dismissNotice}
      />
    </BrowserRouter>
  );
}

export default App;
