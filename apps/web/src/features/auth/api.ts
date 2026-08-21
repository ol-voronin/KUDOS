import { AdminSessionDto, AuthOkDto, LoginRequestDto } from '@dt/contracts';
import { apiFetch } from '@/lib/api-client';

export function login(credentials: LoginRequestDto): Promise<AuthOkDto> {
  return apiFetch('/auth/login', AuthOkDto, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export function logout(): Promise<AuthOkDto> {
  return apiFetch('/auth/logout', AuthOkDto, { method: 'POST' });
}

export function fetchMe(): Promise<AdminSessionDto> {
  return apiFetch('/auth/me', AdminSessionDto);
}
