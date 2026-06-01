export type AuthUser = {
  id: string;
  email: string;
  fullName: string | null;
};

export type AuthErrorResult = {
  error: true;
  message: string;
};

export type AuthSuccessResult = {
  error: false;
};
