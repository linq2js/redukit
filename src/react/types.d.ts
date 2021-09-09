export interface Loadable<T> {
  loading: boolean;
  data: T;
  error: Error;
  pending: boolean;
}
