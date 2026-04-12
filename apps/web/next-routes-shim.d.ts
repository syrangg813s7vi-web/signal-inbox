declare module "./routes.js" {
  export type AppRoutes = string;
  export type AppRouteHandlerRoutes = string;
  export type LayoutRoutes = string;
  export type ParamMap = Record<string, Record<string, string | string[] | undefined>>;
}
