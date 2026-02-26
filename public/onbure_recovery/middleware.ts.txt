import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
    matcher: ["/discovery/:path*", "/requests/:path*", "/chat/:path*", "/workspace/:path*"],
};
