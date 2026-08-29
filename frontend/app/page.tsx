'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

interface LoginResponse {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: 'USER' | 'LEADER' | 'ADMIN';
  };
}

export default function HomePage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(
        'http://127.0.0.1:3001/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email,
            password,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.message ?? '로그인에 실패했습니다.',
        );
      }

      const loginData = data as LoginResponse;

      localStorage.setItem(
        'qa_checker_token',
        loginData.token,
      );

      localStorage.setItem(
        'qa_checker_user',
        JSON.stringify(loginData.user),
      );

      router.push('/dashboard');
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : '로그인 중 오류가 발생했습니다.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand">
          <div className="brand-mark">Q</div>

          <div>
            <h1>QA Checker</h1>
            <p>Game Quality Assurance Platform</p>
          </div>
        </div>

        <div className="login-intro">
          <h2>로그인</h2>
          <p>
            프로젝트와 QA 검사를 관리하려면
            계정으로 로그인하세요.
          </p>
        </div>

        <form
          className="login-form"
          onSubmit={handleSubmit}
        >
          <label>
            이메일
            <input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(event) =>
                setEmail(event.target.value)
              }
              required
            />
          </label>

          <label>
            비밀번호
            <input
              type="password"
              placeholder="비밀번호를 입력하세요"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              required
            />
          </label>

          {errorMessage && (
            <div className="login-error">
              {errorMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? '로그인 중...'
              : '로그인'}
          </button>
        </form>

        <div className="login-footer">
          <span>QA Checker Portfolio MVP</span>
        </div>
      </section>
    </main>
  );
}