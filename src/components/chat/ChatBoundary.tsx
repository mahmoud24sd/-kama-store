'use client';

import { Component, type ReactNode } from 'react';

/**
 * يحمي واجهة الدردشة: لو حدث أي خطأ غير متوقع داخلها يظهر زر «إعادة تحميل المحادثة»
 * داخل نفس المكان بدل أن تسقط الصفحة كلها.
 */
export default class ChatBoundary extends Component<{ children: ReactNode }, { failed: boolean; attempt: number }> {
  state = { failed: false, attempt: 0 };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[ChatBoundary]', error);
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="space-y-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900" role="alert">
          <p>تعذّر عرض المحادثة هذه المرة. رسائل العميل محفوظة ولم تضِع.</p>
          <button
            type="button"
            className="rounded-lg bg-brand-800 px-4 py-2 font-semibold text-white"
            onClick={() => this.setState((s) => ({ failed: false, attempt: s.attempt + 1 }))}
          >
            إعادة تحميل المحادثة
          </button>
        </div>
      );
    }
    // تغيير key عند كل إعادة محاولة يعيد بناء المحادثة من الصفر
    return <div key={this.state.attempt}>{this.props.children}</div>;
  }
}
