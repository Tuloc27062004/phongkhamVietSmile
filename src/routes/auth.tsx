import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Đăng nhập — Việt Smile Clinic Suite" },
      {
        name: "description",
        content: "Đăng nhập vào hệ thống quản lý phòng khám nha khoa Việt Smile.",
      },
      { property: "og:title", content: "Đăng nhập — Việt Smile Clinic Suite" },
      {
        property: "og:description",
        content: "Khu vực dành cho nhân viên phòng khám nha khoa Việt Smile.",
      },
    ],
  }),
  component: AuthPage,
});

const credentialsSchema = z.object({
  email: z.string().email("Email không hợp lệ"),
  password: z.string().min(6, "Mật khẩu tối thiểu 6 ký tự"),
  fullName: z.string().optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const { mode } = Route.useSearch();
  const [tab, setTab] = useState<"signin" | "signup">(mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        void navigate({ to: "/dashboard", replace: true });
      } else {
        setChecking(false);
      }
    });
  }, [navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = credentialsSchema.safeParse({ email, password, fullName });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
      return;
    }

    setLoading(true);
    try {
      if (tab === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Tài khoản đã được tạo. Vui lòng kiểm tra email để xác nhận.");
          return;
        }
        toast.success("Chào mừng bạn đến với hệ thống!");
        void navigate({ to: "/dashboard", replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Đăng nhập thành công");
        void navigate({ to: "/dashboard", replace: true });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể xử lý yêu cầu";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="brand-gradient hidden flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-card/20">
            <Sparkles className="size-5 text-primary-foreground" />
          </div>
          <p className="text-lg font-semibold text-primary-foreground">Việt Smile Clinic Suite</p>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-snug text-primary-foreground">
            Chấm công chính xác. Lịch hẹn gọn gàng. Nhân sự rõ ràng.
          </h2>
          <p className="mt-4 text-sm text-primary-foreground/80">
            Toàn bộ dữ liệu phòng khám được bảo vệ theo vai trò người dùng và chỉ dành cho nhân sự
            nội bộ.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/70">
          © 2026 Nha khoa Việt Smile — Hệ thống quản lý nội bộ
        </p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="surface-card w-full max-w-md p-8">
          <h1 className="text-2xl font-semibold tracking-tight">Khu vực nhân viên</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Đăng nhập bằng tài khoản do phòng khám cấp.
          </p>

          <Tabs
            value={tab}
            onValueChange={(value) => setTab(value as "signin" | "signup")}
            className="mt-6"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Đăng nhập</TabsTrigger>
              <TabsTrigger value="signup">Tạo tài khoản</TabsTrigger>
            </TabsList>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <TabsContent value="signup" className="m-0 space-y-2">
                <Label htmlFor="fullName">Họ và tên</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Nguyễn Thị Hồng Vân"
                  autoComplete="name"
                />
              </TabsContent>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ten@vietsmile.vn"
                  autoComplete="email"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={tab === "signup" ? "new-password" : "current-password"}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {tab === "signup" ? "Tạo tài khoản" : "Đăng nhập"}
              </Button>
            </form>
          </Tabs>

          <p className="mt-6 text-xs text-muted-foreground">
            Tài khoản đầu tiên của phòng khám sẽ tự động nhận quyền quản trị viên. Các tài khoản sau
            do quản trị viên phân quyền.
          </p>
        </div>
      </div>
    </div>
  );
}
