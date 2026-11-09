'use client';

import { Component, type ReactNode } from 'react';

/** يمنع أي خطأ في ميزة إضافية (الدردشة/الإشعارات) من إسقاط الموقع كله: يخفي الميزة فقط. */
export default class SafeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[SafeBoundary]', error);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
