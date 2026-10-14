import { describe, expect, it } from "vitest";
import { bootScript, wslControlError } from "./wsl";

const home = { kind: "home" as const, host: "127.0.0.1", sshPort: 2222, sshUser: "deploy", wslDistro: "Ubuntu-24.04" };

describe("WSL serverni boshqarish", () => {
  it("faqat Windows'dagi ishchi, uy serveri, mahalliy manzil va to'g'ri distributiv nomi bilan", () => {
    expect(wslControlError(home, "win32")).toBeNull();
    expect(wslControlError(home, "linux")).toMatch(/Windows/);
    expect(wslControlError({ ...home, kind: "online" }, "win32")).toMatch(/uydagi/);
    expect(wslControlError({ ...home, host: "10.0.0.5" }, "win32")).toMatch(/127\.0\.0\.1/);
    expect(wslControlError({ ...home, wslDistro: null }, "win32")).toMatch(/distributiv/);
    // Buyruqqa aralashadigan belgilar o'tmaydi
    expect(wslControlError({ ...home, wslDistro: "Ubuntu; rm -rf /" }, "win32")).toMatch(/distributiv/);
    expect(wslControlError({ ...home, sshUser: "deploy;id" }, "win32")).toMatch(/foydalanuvchi/);
  });

  it("yoqish skripti xizmatlarni ishga tushiradi va jarayonni ushlab turadi", () => {
    expect(bootScript("deploy")).toBe(
      "systemctl start ssh nginx postgresql >/dev/null 2>&1; systemctl start pm2-deploy >/dev/null 2>&1; exec sleep infinity",
    );
    expect(() => bootScript("$(id)")).toThrow();
  });
});
