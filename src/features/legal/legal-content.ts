/**
 * Copy for the three public legal pages. Plain data so the pages stay one layout
 * (LegalPage) and the wording can be reviewed without reading JSX.
 */
export type LegalSection = { id: string; title: string; paragraphs: string[] };
export type LegalDocument = {
  title: string;
  summary: string;
  updatedAt: string;
  sections: LegalSection[];
};

export const LEGAL_ROUTES = {
  terms: '/legal/terms',
  privacy: '/legal/privacy',
  slotRules: '/legal/slot-rules',
  basis: '/legal/basis',
} as const;

/**
 * The two commitments a vendor accepts when applying for a slot. The backend only
 * stores *that* they were accepted and when, so this text is the contract the
 * agreement tick on the rental form stands for.
 */
export const SLOT_COMMITMENTS = [
  'Tôi kinh doanh đúng vị trí, diện tích, khung giờ được cấp và không lấn lối đi chung.',
  'Tôi giữ vệ sinh, tuân thủ phòng cháy chữa cháy và quy định của Phường.',
] as const;

export const TERMS: LegalDocument = {
  title: 'Điều khoản sử dụng',
  summary: 'Các quy định chung khi bạn dùng StreetBiz.',
  updatedAt: '16/10/2026',
  sections: [
    {
      id: 'tai-khoan',
      title: 'Tài khoản',
      paragraphs: [
        'Mỗi người dùng một tài khoản, đăng ký bằng số điện thoại chính chủ và xác thực bằng mã OTP.',
        'Bạn tự giữ bí mật mật khẩu và chịu trách nhiệm cho mọi thao tác thực hiện bằng tài khoản của mình.',
      ],
    },
    {
      id: 'vai-tro',
      title: 'Vai trò',
      paragraphs: [
        'Người mua khám phá và đặt món; hộ kinh doanh nộp hồ sơ, thuê ô vỉa hè và bán hàng; cán bộ phường duyệt hồ sơ và kiểm tra trật tự vỉa hè.',
        'Mỗi vai trò chỉ thấy và thao tác trên dữ liệu thuộc phạm vi của mình.',
      ],
    },
    {
      id: 'su-dung',
      title: 'Sử dụng đúng mục đích',
      paragraphs: [
        'Không khai báo sai thông tin, giả mạo giấy tờ, đăng nội dung vi phạm pháp luật hoặc xúc phạm người khác.',
        'Tài khoản vi phạm có thể bị tạm khoá, nội dung vi phạm có thể bị ẩn.',
      ],
    },
    {
      id: 'ai',
      title: 'Trợ lý AI',
      paragraphs: [
        'Các gợi ý do AI tạo ra chỉ mang tính tham khảo. Mọi quyết định duyệt, xử phạt hay cấp phép đều do cán bộ phường đưa ra.',
      ],
    },
    {
      id: 'thanh-toan',
      title: 'Thanh toán',
      paragraphs: [
        'Phí thuê ô, tiền phạt và đơn hàng được thanh toán qua các cổng thanh toán tích hợp. Hoá đơn được lưu trong mục Tài chính.',
      ],
    },
    {
      id: 'thay-doi',
      title: 'Thay đổi điều khoản',
      paragraphs: [
        'Điều khoản có thể được cập nhật. Ngày cập nhật luôn ghi ở đầu trang; tiếp tục sử dụng nghĩa là bạn đồng ý với bản mới.',
      ],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  title: 'Chính sách bảo mật',
  summary: 'StreetBiz thu thập dữ liệu gì, để làm gì và ai được xem.',
  updatedAt: '16/10/2026',
  sections: [
    {
      id: 'thu-thap',
      title: 'Dữ liệu thu thập',
      paragraphs: [
        'Số điện thoại, họ tên, phường đăng ký.',
        'Ảnh CCCD và ảnh chân dung khi nộp hồ sơ kinh doanh (eKYC), giấy tờ đính kèm.',
        'Vị trí khi bạn dùng bản đồ, quét QR hoặc khi cán bộ phường kiểm tra tại chỗ.',
        'Ảnh, giọng nói và nội dung chat khi bạn dùng trợ lý AI.',
      ],
    },
    {
      id: 'muc-dich',
      title: 'Mục đích',
      paragraphs: [
        'Xác minh danh tính, xét duyệt hồ sơ và hợp đồng thuê ô, cấp giấy phép QR, thu phí và xử lý vi phạm.',
        'Không bán hoặc chia sẻ dữ liệu cho bên thứ ba vì mục đích quảng cáo.',
      ],
    },
    {
      id: 'nguoi-xem',
      title: 'Ai được xem',
      paragraphs: [
        'Cán bộ phường phụ trách xem hồ sơ và giấy tờ của hộ kinh doanh trong phường mình.',
        'Người mua chỉ thấy thông tin công khai của quán (tên, vị trí, giấy phép còn hiệu lực).',
      ],
    },
    {
      id: 'luu-tru',
      title: 'Thời gian lưu',
      paragraphs: [
        'Lịch sử chat với trợ lý AI được lưu 30 ngày. Hồ sơ, hợp đồng và hoá đơn được lưu theo quy định quản lý hành chính.',
      ],
    },
    {
      id: 'quyen',
      title: 'Quyền của bạn',
      paragraphs: [
        'Xem và cập nhật thông tin tài khoản, đăng xuất khỏi các thiết bị khác, xoá lịch sử chat với trợ lý.',
      ],
    },
  ],
};

export const SLOT_RULES: LegalDocument = {
  title: 'Quy định thuê ô vỉa hè',
  summary: 'Những điều bạn đồng ý khi nộp đơn thuê ô.',
  updatedAt: '16/10/2026',
  sections: [
    {
      id: 'cam-ket',
      title: 'Cam kết khi kinh doanh',
      paragraphs: [...SLOT_COMMITMENTS],
    },
    {
      id: 'giu-cho',
      title: 'Giữ chỗ',
      paragraphs: [
        'Bạn có thể giữ một ô còn trống trong 15 phút để cân nhắc. Hết thời gian, ô tự trả lại cho người khác.',
      ],
    },
    {
      id: 'bao-gia',
      title: 'Cách tính tiền',
      paragraphs: [
        'Ô cố định thuê theo tháng (1, 3, 6 hoặc 12 tháng); khu sự kiện thuê theo ngày.',
        'Thuê 3, 6 hoặc 12 tháng được giảm theo mức của từng tuyến (nếu có).',
        'Tiền cọc được hoàn lại khi kết thúc hợp đồng.',
        'Phụ phí ghi "tham khảo" chưa tính vào hợp đồng.',
        'Số tiền trên đơn là ước tính; giá chính thức chốt theo giá tuyến tại thời điểm Phường duyệt.',
      ],
    },
    {
      id: 'duyet',
      title: 'Duyệt và hợp đồng',
      paragraphs: [
        'Cần có hồ sơ kinh doanh đã được duyệt. Khi Phường duyệt đơn, hợp đồng và giấy phép QR được tạo tự động.',
      ],
    },
    {
      id: 'vi-pham',
      title: 'Vi phạm',
      paragraphs: [
        'Vi phạm cam kết có thể bị lập biên bản, phạt, tạm ngưng hoặc thu hồi giấy phép theo khung xử phạt của Phường.',
      ],
    },
  ],
};

/** Every law and decision the screens used to quote inline, kept in one place. */
export const LEGAL_BASIS: LegalDocument = {
  title: 'Căn cứ pháp lý',
  summary: 'Các văn bản mà StreetBiz dựa vào. Thông tin tham khảo, không thay tư vấn pháp lý.',
  updatedAt: '16/10/2026',
  sections: [
    {
      id: 'tuyen',
      title: 'Tuyến cho thuê ô',
      paragraphs: [
        'Mỗi tuyến được cho phép bằng một quyết định của UBND; số hiệu quyết định ghi trong hồ sơ tuyến và hiện khi bạn rê chuột vào mục Căn cứ pháp lý của tuyến đó.',
      ],
    },
    {
      id: 'duyet-ho-so',
      title: 'Thẩm quyền và thời hạn duyệt hồ sơ',
      paragraphs: [
        'Thẩm quyền quyết định hành chính, trình tự thủ tục và hạn xử lý hồ sơ căn cứ Luật Đường bộ 2024 (Điều 77) và Nghị định 165/2024/NĐ-CP (Điều 21), được sửa đổi bởi Nghị định 241/2026/NĐ-CP (hiệu lực 01/07/2026): thời hạn xử lý còn tối đa 3 ngày làm việc, tang lễ tối đa 1 ngày; thẩm quyền cấp phép các trường hợp còn lại thuộc UBND cấp xã. Thẩm quyền thu phí nộp ngân sách nhà nước căn cứ Luật Phí và Lệ phí 2015.',
        'Việc cho phép sử dụng hè phố cho hoạt động kinh doanh cụ thể thực hiện theo Đề án/Quyết định thí điểm quản lý, khai thác hè phố của UBND thành phố Đà Nẵng (cần cập nhật số hiệu văn bản chính thức khi ban hành). Các trường hợp liệt kê tại Điều 21 Nghị định 165/2024 là trường hợp phi thương mại (sự kiện, phòng chống thiên tai, thi công…), không trực tiếp bao gồm kinh doanh hàng hóa.',
      ],
    },
    {
      id: 'cap-phuong',
      title: 'Thẩm quyền cấp phường đối với hồ sơ hộ kinh doanh',
      paragraphs: [
        'Theo Nghị định 168/2025/NĐ-CP (thay thế Nghị định 01/2021/NĐ-CP từ 01/07/2025) và mô hình chính quyền địa phương 2 cấp, thẩm quyền cấp Giấy chứng nhận đăng ký hộ kinh doanh thuộc Phòng Kinh tế / Phòng Kinh tế, Hạ tầng và Đô thị thuộc UBND cấp xã (phường), không còn cấp quận/huyện.',
        'Thủ tục thẩm định điểm bán vỉa hè trên StreetBiz xác nhận điều kiện trật tự đô thị, an toàn giao thông và vệ sinh môi trường tại địa bàn phường. Thủ tục này không thay thế Giấy chứng nhận đăng ký hộ kinh doanh: hộ kinh doanh vẫn phải đăng ký riêng theo Mẫu số 01 Phụ lục II, Thông tư 68/2025/TT-BTC.',
      ],
    },
    {
      id: 'kinh-doanh',
      title: 'Đăng ký kinh doanh vỉa hè',
      paragraphs: [
        'Nghị định 01/2021/NĐ-CP (Điều 79 khoản 2) và Nghị định 39/2007/NĐ-CP: người bán hàng rong, lưu động được miễn đăng ký hộ kinh doanh; ngành có điều kiện (như đồ ăn, thức uống) vẫn phải đáp ứng điều kiện riêng, ở đây là cam kết ATTP.',
        'Hồ sơ chủ hộ kê khai theo Mẫu số 01 Phụ lục II, Thông tư 68/2025/TT-BTC.',
      ],
    },
    {
      id: 'du-lieu',
      title: 'Dữ liệu cá nhân và eKYC',
      paragraphs: [
        'Luật Bảo vệ dữ liệu cá nhân 2025 và Nghị định 356/2025/NĐ-CP: việc nhận dạng ảnh CCCD và đối chiếu khuôn mặt chỉ thực hiện khi bạn đồng ý riêng. Không đồng ý vẫn nộp hồ sơ được, cán bộ phường đối chiếu giấy tờ trực tiếp.',
      ],
    },
    {
      id: 'xu-phat',
      title: 'Trật tự hè phố và xử phạt',
      paragraphs: [
        'Nghị định 118/2021/NĐ-CP và Nghị định 168/2024/NĐ-CP làm căn cứ lập biên bản và xác định mức phạt; Nghị định 165/2024/NĐ-CP và Luật Đường bộ 2024 quy định lối đi bộ tối thiểu 1,5 m.',
        'Mức phạt cụ thể và căn cứ của từng hành vi do Phường công bố trong biểu mức phạt.',
      ],
    },
  ],
};
