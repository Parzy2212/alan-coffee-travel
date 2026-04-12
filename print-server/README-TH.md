# AlanPOS Print Server — คู่มือติดตั้ง

โปรแกรมนี้ช่วยให้พิมพ์ใบเสร็จจาก Chrome/Edge ไปยังเครื่องพิมพ์ USB ได้โดยตรง

---

## วิธีติดตั้ง (ครั้งแรกครั้งเดียว)

1. **ดับเบิ้ลคลิก** `installer.bat`
2. คลิก **"Yes"** เมื่อ Windows ถามสิทธิ์ Admin
3. **รอสักครู่** — โปรแกรมจะติดตั้งและเริ่มทำงานอัตโนมัติ
4. **เสร็จแล้ว** — ไม่ต้องทำอะไรเพิ่ม

หลังติดตั้ง โปรแกรมจะ:
- ทำงานอยู่เงียบๆ ใน background
- เริ่มต้นอัตโนมัติทุกครั้งที่เปิดคอมพิวเตอร์

---

## เปิดใช้งาน POS

เปิดเบราว์เซอร์ Chrome หรือ Edge แล้วไปที่:

**https://alan-coffee-travel.vercel.app/pos**

ระบบจะพิมพ์ใบเสร็จผ่าน print server อัตโนมัติ
ไม่ต้องเชื่อมต่อ USB แบบ WebUSB แล้ว

---

## ถ้าเครื่องพิมพ์ไม่พิมพ์

1. ตรวจสอบว่าเสียบสาย USB เครื่องพิมพ์อยู่
2. ตรวจสอบว่าเครื่องพิมพ์เปิดอยู่
3. เปิด Chrome แล้วไปที่:
   `http://localhost:12345/status`
   — ถ้าเห็น `{"ok":true}` แสดงว่า print server ทำงานอยู่

---

## ติดตั้งโดยใช้ IP เครื่องพิมพ์ WiFi (ถ้ามี)

ถ้าเครื่องพิมพ์ต่อ WiFi ให้ใส่ IP ในหน้า POS Settings
เช่น `192.168.1.100` — ระบบจะส่งงานพิมพ์ผ่าน WiFi แทน USB

---

## สำหรับช่างเทคนิค

| ไฟล์ | รายละเอียด |
|------|------------|
| `server.js` | source code (Node.js) |
| `package.json` | dependencies + build script |
| `installer.bat` | Windows installer |
| `AlanPOS-PrintServer.exe` | standalone executable (build ด้วย `npm run build`) |

**Build exe:** ต้องมี Node.js + รัน `npm install` แล้ว `npm run build`
