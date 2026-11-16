import { Component } from "react";
import { Notice } from "./UI";

export default class PageBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="panel stack">
          <Notice>
            This page couldn’t open. Refresh to load the latest version, or
            choose another page.
          </Notice>
          <button
            className="btn btn-secondary"
            onClick={() => window.location.reload()}
          >
            Refresh workspace
          </button>
        </div>
      );
    return this.props.children;
  }
}
