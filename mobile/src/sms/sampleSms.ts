import { addDays, startOfDay } from '@/lib/format';

export interface RawSms { id: string; address: string; body: string; date: number }

/**
 * Illustrative messages that follow the general shape of Ethiopian bank/wallet SMS.
 * They are NOT guaranteed to match real bank templates; replace with anonymised real samples.
 */
export function demoSms(now = Date.now()): RawSms[] {
  const at = (daysAgo: number, h: number, m = 0) => addDays(startOfDay(now), -daysAgo) + (h * 60 + m) * 60000;
  const list: Array<[string, string, number]> = [
    ['CBE', 'Dear Haile your Account 1*****4821 has been Credited with ETB 20,000.00 from ABC Trading PLC Salary, on 01/10/2026 at 09:15:02 with Ref No FT26274XK2P1. Your Current Balance is ETB 24,350.00. Thank you for Banking with CBE', at(14, 9, 15)],
    ['CBE', 'Dear Haile your Account 1*****4821 has been debited with ETB 1,200.00. Service charge of ETB 0.50 and VAT(15%) of ETB 0.08 with a total of ETB 1,200.58. Ref No FT26274AB91Q. Your Current Balance is ETB 23,149.42. Thank you for Banking with CBE', at(13, 12, 40)],
    ['CBE', 'Dear Haile your Account 1*****4821 has been debited with ETB 5,000.00 for cash withdrawal at ATM Bole. Service charge of ETB 2.00 and VAT(15%) of ETB 0.30. Ref No FT26275ZZ31M. Your Current Balance is ETB 18,147.12. Thank you for Banking with CBE', at(12, 17, 5)],
    ['CBE', 'Dear Haile your Account 1*****4821 has been debited with ETB 1,000.00 to Telebirr Haile (2519****0412). Ref No FT26277TT10C. Your Current Balance is ETB 17,147.12. Thank you for Banking with CBE', at(10, 8, 30)],
    ['127', 'Dear Haile You have received ETB 1,000.00 from CBE Transfer on 05/10/2026 08:31:10. Your transaction number is DJ58K2LM91. Your current balance is ETB 1,430.50.', at(10, 8, 31)],
    ['127', 'Dear Haile You have paid ETB 185.00 for goods purchased from Tomoca Coffee Bole on 05/10/2026 10:02:11. Your transaction number is DJ58P7QW11. Your current balance is ETB 1,245.50.', at(10, 10, 2)],
    ['127', 'Dear Haile You have transferred ETB 350.00 to Meseret Alemu (2519****7731) on 07/10/2026 19:20:41. Service fee ETB 1.00 and VAT ETB 0.15. Your transaction number is DK10A9ZB22. Your current balance is ETB 893.35.', at(8, 19, 20)],
    ['127', 'Dear Haile You have recharged ETB 100.00 airtime for 2519****0412 on 08/10/2026 07:45:00. Your transaction number is DK11B4CX03. Your current balance is ETB 793.35.', at(7, 7, 45)],
    ['CBE', 'Dear Haile your Account 1*****4821 has been debited with ETB 3,500.00 to Ato Girma House Rent. Ref No FT26281RR77D. Your Current Balance is ETB 13,647.12. Thank you for Banking with CBE', at(6, 11, 0)],
    ['CBE', 'Dear Haile your Account 1*****4821 has been debited with ETB 640.00 for Ethiopian Electric Utility bill. Service charge of ETB 1.00 and VAT(15%) of ETB 0.15. Ref No FT26282EE05W. Your Current Balance is ETB 13,005.97. Thank you for Banking with CBE', at(5, 14, 22)],
    ['127', 'Dear Haile You have received ETB 750.00 from Dawit Bekele (2519****3321) on 11/10/2026 13:10:05. Your transaction number is DL02C8VN44. Your current balance is ETB 1,543.35.', at(4, 13, 10)],
    ['127', 'Dear Haile You have paid ETB 420.00 for goods purchased from Shoa Supermarket on 12/10/2026 18:44:51. Your transaction number is DL03D1MP56. Your current balance is ETB 1,123.35.', at(3, 18, 44)],
    ['Dashen', 'Dear Customer, your account 0*****9913 has been debited with ETB 260.00 at Ride Taxi. Your balance is ETB 4,740.00. Ref: DSH88213TX', at(2, 8, 5)],
    ['Dashen', 'Dear Customer, your account 0*****9913 has been credited with ETB 1,500.00 cash deposit. Your balance is ETB 6,240.00. Ref: DSH88290DP', at(1, 16, 50)],
    ['CBE', 'Your OTP is 482913. Do not share this code with anyone. Commercial Bank of Ethiopia', at(1, 9, 0)],
    ['Awash', 'Dear Customer, your savings statement is available. Visit the nearest Awash Bank branch for details.', at(0, 9, 30)],
    ['CBE', 'Dear Haile your Account 1*****4821 has been debited with ETB 275.00 to Kaldis Coffee. Ref No FT26287KC42H. Your Current Balance is ETB 12,730.97. Thank you for Banking with CBE', at(0, 10, 10)],
  ];
  return list.map(([address, body, date], i) => ({ id: `demo-${i}`, address, body, date }));
}
