import React, { Component } from 'react';
import { FaExclamationTriangle, FaRedo } from 'react-icons/fa';
import { Button } from '../ui/Button';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught UI Exception:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="max-w-md w-full glass-panel rounded-2xl p-8 text-center space-y-4 border border-rose-500/30">
            <div className="inline-flex p-4 rounded-full bg-rose-500/10 text-rose-400">
              <FaExclamationTriangle className="text-4xl animate-bounce" />
            </div>
            
            <h2 className="text-2xl font-bold text-slate-100">Application Rendering Exception</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              TrafficVision AI encountered an unexpected UI rendering fault. Diagnostic details:
            </p>

            {this.state.error && (
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-left font-mono text-[10px] text-rose-300 overflow-x-auto max-h-40">
                <p className="font-bold mb-1">{this.state.error.name}: {this.state.error.message}</p>
                {this.state.error.stack && (
                  <pre className="mt-1 text-slate-400 whitespace-pre-wrap">{this.state.error.stack}</pre>
                )}
              </div>
            )}

            <div className="pt-4">
              <Button onClick={this.handleReload} className="w-full space-x-2">
                <FaRedo />
                <span>Reload Dashboard Interface</span>
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
