/**
 * Copy for the four public legal pages. Plain data so every page shares one layout
 * (LegalPage) and the wording can be reviewed without reading JSX.
 *
 * The same file lives in StreetBiz-App (src/features/legal/legal-content.ts); keep them identical.
 * Section ids are linked from other screens (`/legal/slot-rules#bao-gia`, `/legal/basis#du-lieu`, ...),
 * so never rename an id.
 */
export type LegalBlock =
  /** A paragraph. */
  | { kind: 'p'; text: string }
  /** A bulleted list. */
  | { kind: 'list'; items: string[] }
  /** A numbered procedure, in order. */
  | { kind: 'steps'; items: string[] }
  /** A small table; every row has as many cells as `head`. */
  | { kind: 'table'; head: string[]; rows: string[][] }
  /** A highlighted remark: `info` for a good-to-know, `warn` for something that can cost the reader. */
  | { kind: 'note'; tone: 'info' | 'warn'; title: string; text: string };

export type LegalSection = { id: string; title: string; blocks: LegalBlock[] };

export type LegalDocument = {
  title: string;
  summary: string;
  /** dd/mm/yyyy, the day the wording was last checked against the system and the law. */
  updatedAt: string;
  /** The points a reader should not leave without. */
  highlights: string[];
  sections: LegalSection[];
};

export const LEGAL_ROUTES = {
  terms: '/legal/terms',
  privacy: '/legal/privacy',
  slotRules: '/legal/slot-rules',
  basis: '/legal/basis',
} as const;

/** The titles of the four pages, for "see also" links. */
export const LEGAL_PAGES = [
  { to: LEGAL_ROUTES.terms, title: 'Điều khoản sử dụng' },
  { to: LEGAL_ROUTES.privacy, title: 'Chính sách bảo mật' },
  { to: LEGAL_ROUTES.slotRules, title: 'Quy định thuê ô vỉa hè' },
  { to: LEGAL_ROUTES.basis, title: 'Căn cứ pháp lý' },
] as const;

/**
 * The two commitments a vendor accepts when applying for a slot. The backend only
 * stores *that* they were accepted and when, so this text is the contract the
 * agreement tick on the rental form stands for.
 */
export const SLOT_COMMITMENTS = [
  'Tôi kinh doanh đúng vị trí, diện tích, khung giờ được cấp và không lấn lối đi chung.',
  'Tôi giữ vệ sinh, tuân thủ phòng cháy chữa cháy và quy định của Phường.',
] as const;

const UPDATED = '18/11/2026';

// ---------------------------------------------------------------------------------------------
// Điều khoản sử dụng
// ---------------------------------------------------------------------------------------------

export const TERMS: LegalDocument = {
  title: 'Điều khoản sử dụng',
  summary:
    'Các quy định chung khi bạn dùng StreetBiz, dành cho người mua, hộ kinh doanh và cán bộ phường.',
  updatedAt: UPDATED,
  highlights: [
    'Mỗi người một tài khoản, đăng ký bằng số điện thoại chính chủ và mã OTP.',
    'StreetBiz hỗ trợ quản lý vỉa hè; mọi quyết định duyệt, cấp phép và xử phạt do cán bộ phường đưa ra, không phải AI.',
    'Phí thuê ô trả vào tài khoản của Phường, tiền phạt nộp Kho bạc Nhà nước. StreetBiz không giữ tiền của bạn.',
    'Khai báo sai, giả mạo giấy tờ hoặc lạm dụng báo cáo có thể bị ẩn nội dung, khoá tài khoản và bị xử lý theo pháp luật.',
  ],
  sections: [
    {
      id: 'pham-vi',
      title: 'StreetBiz là gì và không là gì',
      blocks: [
        {
          kind: 'p',
          text: 'StreetBiz là nền tảng giúp Phường quản lý ô vỉa hè theo hướng minh bạch: hộ kinh doanh nộp hồ sơ, thuê ô, nhận giấy phép QR và đóng phí; người mua tra cứu quầy hợp pháp và đặt món; cán bộ phường duyệt hồ sơ, kiểm tra và xử lý vi phạm.',
        },
        {
          kind: 'list',
          items: [
            'StreetBiz không phải cơ quan nhà nước và không thay thế thủ tục hành chính: quyết định duyệt, cấp phép, xử phạt luôn do cán bộ phường có thẩm quyền ký.',
            'StreetBiz không phải ngân hàng hay tổ chức trung gian thanh toán: nền tảng không giữ, không thu hộ tiền của bạn (xem mục Thanh toán).',
            'Điều khoản này đi cùng Chính sách bảo mật và Quy định thuê ô vỉa hè. Khi có mâu thuẫn, quy định của pháp luật được ưu tiên.',
          ],
        },
      ],
    },
    {
      id: 'tai-khoan',
      title: 'Tài khoản',
      blocks: [
        {
          kind: 'list',
          items: [
            'Đăng ký bằng số điện thoại chính chủ và xác thực bằng mã OTP gửi qua SMS. Mỗi số điện thoại chỉ có một tài khoản.',
            'Bạn tự giữ bí mật mật khẩu và chịu trách nhiệm cho mọi thao tác thực hiện bằng tài khoản của mình. Phát hiện lộ mật khẩu, hãy đổi ngay và đăng xuất các thiết bị khác trong mục Tài khoản.',
            'Đăng nhập sai nhiều lần, tài khoản bị khoá tạm thời một thời gian ngắn để chống dò mật khẩu.',
            'Mã OTP và mật khẩu là của riêng bạn: nhân viên StreetBiz, cán bộ phường hay trợ lý AI không bao giờ hỏi bạn các thông tin này.',
          ],
        },
      ],
    },
    {
      id: 'vai-tro',
      title: 'Vai trò và quyền hạn',
      blocks: [
        {
          kind: 'table',
          head: ['Vai trò', 'Được làm gì', 'Không được làm gì'],
          rows: [
            [
              'Khách (chưa đăng nhập)',
              'Xem bản đồ quầy có phép, quét QR kiểm tra giấy phép, gửi báo cáo quầy vi phạm.',
              'Đặt món, đánh giá, đính kèm ảnh vào báo cáo hay theo dõi kết quả xử lý.',
            ],
            [
              'Người mua',
              'Đặt món và nhận tại quầy, đánh giá quầy, gửi và theo dõi báo cáo, trò chuyện với quán.',
              'Xem dữ liệu của người khác.',
            ],
            [
              'Hộ kinh doanh',
              'Nộp hồ sơ, thuê ô, đóng phí, nhận giấy phép QR, bán hàng và quản lý thực đơn.',
              'Thuê ô khi hồ sơ chưa được duyệt; thấy ai đã báo cáo mình.',
            ],
            [
              'Cán bộ phường',
              'Duyệt hồ sơ trong phường mình, kiểm tra tại chỗ, lập biên bản, xác nhận nộp phạt.',
              'Xem hoặc xử lý hồ sơ của phường khác.',
            ],
            [
              'Quản trị nền tảng',
              'Quản lý danh mục món, tài khoản và nội dung bị báo cáo trên chợ món.',
              'Quyết định việc vỉa hè, xem giấy tờ định danh của hộ kinh doanh.',
            ],
          ],
        },
        {
          kind: 'p',
          text: 'Mỗi vai trò chỉ thấy và thao tác trên dữ liệu thuộc phạm vi của mình, hệ thống kiểm tra lại quyền ở máy chủ cho từng yêu cầu.',
        },
      ],
    },
    {
      id: 'su-dung',
      title: 'Sử dụng đúng mục đích',
      blocks: [
        { kind: 'p', text: 'Bạn không được:' },
        {
          kind: 'list',
          items: [
            'Khai báo sai thông tin, giả mạo giấy tờ, mượn hoặc dùng giấy phép, mã QR của người khác.',
            'Đăng nội dung vi phạm pháp luật, xúc phạm người khác, quảng cáo trái phép hoặc đánh giá ảo.',
            'Gửi báo cáo sai sự thật, cố ý quấy rối một quầy hoặc gửi hàng loạt để gây nhiễu.',
            'Dò quét, tấn công, làm quá tải hệ thống hoặc dùng công cụ tự động ngoài những gì ứng dụng cho phép.',
          ],
        },
        {
          kind: 'note',
          tone: 'warn',
          title: 'Hậu quả',
          text: 'Nội dung vi phạm có thể bị ẩn, tài khoản có thể bị tạm khoá. Hồ sơ giả mạo có thể bị từ chối, giấy phép bị thu hồi và vụ việc bị chuyển cơ quan có thẩm quyền xử lý theo pháp luật.',
        },
      ],
    },
    {
      id: 'don-hang',
      title: 'Đặt món và nhận hàng',
      blocks: [
        {
          kind: 'steps',
          items: [
            'Chọn món từ một quầy, thêm vào giỏ. Giỏ chỉ chứa món của một quầy.',
            'Thanh toán trước bằng chuyển khoản VietQR (qua payOS) hoặc ví MoMo khi quán hỗ trợ.',
            'Quán xác nhận và chuẩn bị. Khi sẵn sàng, bạn nhận thông báo.',
            'Đến quầy nhận hàng bằng mã QR hoặc mã đọc của đơn. StreetBiz không giao hàng tận nơi.',
          ],
        },
        {
          kind: 'list',
          items: [
            'Khi đặt, hệ thống có thể kiểm tra bạn đang ở gần quầy; nếu bạn không cấp quyền vị trí hoặc ở quá xa, đơn có thể bị từ chối.',
            'Bạn huỷ được đơn khi quán chưa xác nhận. Nếu có vấn đề với đơn đã xác nhận hoặc đã hoàn tất (sai món, hàng không đạt), hãy dùng chức năng khiếu nại trong chi tiết đơn.',
            'Tiền chuyển khoản VietQR vào thẳng tài khoản payOS của quán, nên việc hoàn tiền (nếu có) do quán thực hiện; StreetBiz ghi nhận và hỗ trợ theo dõi.',
          ],
        },
      ],
    },
    {
      id: 'thanh-toan',
      title: 'Thanh toán',
      blocks: [
        {
          kind: 'table',
          head: ['Khoản', 'Trả cho ai', 'Cách trả'],
          rows: [
            [
              'Phí thuê ô',
              'Phường quản lý ô',
              'Chuyển khoản VietQR (payOS) vào tài khoản của Phường. Hoá đơn lưu trong mục Tài chính.',
            ],
            [
              'Đơn hàng',
              'Quán bạn mua',
              'VietQR (payOS) vào tài khoản của quán, hoặc ví MoMo khi có.',
            ],
            [
              'Tiền phạt vi phạm',
              'Kho bạc Nhà nước',
              'Nộp theo quyết định xử phạt, sau đó tải biên lai lên StreetBiz để Phường xác nhận. StreetBiz không thu tiền phạt.',
            ],
          ],
        },
        {
          kind: 'note',
          tone: 'info',
          title: 'Vì sao StreetBiz không giữ tiền',
          text: 'Thu hộ rồi chuyển lại tiền của người khác là hoạt động của tổ chức trung gian thanh toán và phải có giấy phép. Trả thẳng cho người nhận giúp tiền đi nhanh, tránh nhầm lẫn và rõ ai chịu trách nhiệm hoàn tiền.',
        },
        {
          kind: 'p',
          text: 'Phí thuê ô quá hạn bị đánh dấu quá hạn, hệ thống nhắc bạn và Phường có thể nhắc thêm. Hợp đồng còn nợ quá hạn không gia hạn, trả hoặc chuyển nhượng được (xem Quy định thuê ô).',
        },
      ],
    },
    {
      id: 'ai',
      title: 'Trợ lý AI',
      blocks: [
        {
          kind: 'list',
          items: [
            'Gợi ý, câu trả lời, nội dung đọc từ ảnh hoặc giọng nói của trợ lý do AI tạo ra, luôn được gắn nhãn AI và chỉ mang tính tham khảo.',
            'Số tiền, trạng thái hồ sơ, giấy phép trong câu trả lời lấy từ dữ liệu thật của bạn; nếu chưa đủ căn cứ, trợ lý nói rõ cần kiểm tra thêm.',
            'Mọi quyết định duyệt, xử phạt hay cấp phép do cán bộ phường đưa ra. Trợ lý không thay thế tư vấn pháp lý.',
            'Nội dung bạn gửi cho trợ lý (chữ, ảnh, giọng nói) được xử lý bởi dịch vụ AI bên thứ ba; xem Chính sách bảo mật. Đừng gửi thông tin không cần thiết, như ảnh CCCD.',
          ],
        },
      ],
    },
    {
      id: 'danh-gia-bao-cao',
      title: 'Đánh giá và báo cáo quầy',
      blocks: [
        {
          kind: 'list',
          items: [
            'Chỉ người mua đã đăng nhập mới đánh giá được quầy.',
            'Ai cũng có thể báo cáo quầy bán sai vị trí, không có phép hoặc tính giá cao hơn niêm yết. Khách chưa đăng nhập báo cáo được nhưng không đính kèm ảnh và không theo dõi được kết quả, đồng thời bị giới hạn số báo cáo mỗi giờ.',
            'Báo cáo được chuyển tới Phường phụ trách, không phải quản trị nền tảng. Quầy bị báo cáo không biết ai đã gửi.',
            'Báo cáo cần đúng sự thật. Báo cáo sai có chủ ý có thể bị từ chối và người gửi bị hạn chế.',
          ],
        },
      ],
    },
    {
      id: 'trach-nhiem',
      title: 'Giới hạn trách nhiệm',
      blocks: [
        {
          kind: 'list',
          items: [
            'StreetBiz cố gắng vận hành liên tục nhưng có thể gián đoạn khi bảo trì hoặc khi nhà cung cấp bên thứ ba (SMS, thanh toán, AI) gặp sự cố.',
            'Chất lượng, giá và việc giao nhận món do quán chịu trách nhiệm. Việc duyệt, cấp phép, xử phạt do Phường chịu trách nhiệm.',
            'Bạn có quyền khiếu nại, tố cáo, khởi kiện đối với quyết định hành chính theo quy định của pháp luật.',
          ],
        },
      ],
    },
    {
      id: 'thay-doi',
      title: 'Thay đổi và luật áp dụng',
      blocks: [
        {
          kind: 'list',
          items: [
            'Điều khoản có thể được cập nhật. Ngày cập nhật luôn ghi ở đầu trang; tiếp tục sử dụng sau khi cập nhật nghĩa là bạn đồng ý với bản mới.',
            'Điều khoản áp dụng theo pháp luật Việt Nam. Tranh chấp ưu tiên thương lượng; nếu không thoả thuận được, giải quyết tại cơ quan có thẩm quyền theo quy định của pháp luật.',
          ],
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// Chính sách bảo mật
// ---------------------------------------------------------------------------------------------

export const PRIVACY: LegalDocument = {
  title: 'Chính sách bảo mật',
  summary:
    'StreetBiz thu thập dữ liệu gì, dùng để làm gì, ai được xem, lưu bao lâu và bạn có những quyền nào.',
  updatedAt: UPDATED,
  highlights: [
    'Chỉ thu thập dữ liệu cần để xác minh, xét duyệt, thu phí và xử lý vi phạm. Không bán dữ liệu, không quảng cáo theo dõi.',
    'Nhận dạng ảnh CCCD (eKYC) chỉ làm khi bạn đồng ý riêng; không đồng ý vẫn nộp hồ sơ được.',
    'Lịch sử chat với trợ lý lưu 30 ngày và bạn xoá được bất cứ lúc nào. Âm thanh giọng nói không được lưu.',
    'Một số bên xử lý dữ liệu đặt máy chủ ở nước ngoài (AI, hạ tầng web, thông báo đẩy); xem bảng Bên xử lý dữ liệu.',
  ],
  sections: [
    {
      id: 'thu-thap',
      title: 'Dữ liệu thu thập',
      blocks: [
        {
          kind: 'table',
          head: ['Nhóm', 'Gồm', 'Khi nào'],
          rows: [
            [
              'Tài khoản',
              'Số điện thoại, họ tên, phường, ảnh đại diện (tuỳ chọn). Mật khẩu chỉ lưu dạng băm, không đọc lại được.',
              'Khi đăng ký và cập nhật tài khoản.',
            ],
            [
              'Hồ sơ kinh doanh',
              'Họ tên, số định danh, địa chỉ chủ hộ và địa chỉ bán, thành viên hộ, giấy tờ đính kèm; ảnh CCCD và ảnh chân dung nếu bạn đồng ý eKYC.',
              'Khi hộ kinh doanh nộp hồ sơ.',
            ],
            [
              'Vị trí',
              'Toạ độ của thiết bị.',
              'Khi bạn dùng bản đồ, quét QR, đặt món (kiểm tra gần quầy) hoặc khi cán bộ phường kiểm tra tại chỗ. Cần bạn cấp quyền trên thiết bị.',
            ],
            [
              'Giao dịch',
              'Đơn hàng, phí thuê ô, hoá đơn, biên lai nộp phạt. StreetBiz không lưu số thẻ hay mật khẩu ngân hàng của bạn.',
              'Khi bạn thanh toán hoặc nộp biên lai.',
            ],
            [
              'Trợ lý AI',
              'Nội dung chat, ảnh bạn gửi, phụ đề của lời nói. Âm thanh gốc không được lưu.',
              'Khi bạn dùng trợ lý.',
            ],
            [
              'Kỹ thuật',
              'Lịch sử đăng nhập, thiết bị, địa chỉ IP, mã thiết bị nhận thông báo đẩy, nhật ký thao tác của cán bộ.',
              'Tự động khi dùng dịch vụ.',
            ],
          ],
        },
      ],
    },
    {
      id: 'muc-dich',
      title: 'Mục đích và cơ sở xử lý',
      blocks: [
        {
          kind: 'list',
          items: [
            'Xác minh danh tính, xét duyệt hồ sơ và hợp đồng thuê ô, cấp giấy phép QR, thu phí và xử lý vi phạm: để thực hiện dịch vụ bạn yêu cầu và để Phường thực hiện quản lý nhà nước.',
            'Gửi OTP, thông báo đơn hàng, nhắc phí: để vận hành tài khoản.',
            'Trả lời câu hỏi, đọc ảnh, nhận lời nói: để thực hiện tính năng trợ lý bạn chủ động dùng.',
            'Bảo vệ an toàn hệ thống: chống mạo danh, gửi OTP hàng loạt, truy cập trái phép.',
          ],
        },
        {
          kind: 'note',
          tone: 'info',
          title: 'Điều StreetBiz không làm',
          text: 'Không bán hoặc chia sẻ dữ liệu cho bên thứ ba vì mục đích quảng cáo, không dùng công cụ theo dõi hành vi hay cookie quảng cáo.',
        },
        {
          kind: 'p',
          text: 'Các việc cần sự đồng ý riêng, như nhận dạng ảnh CCCD, chỉ làm khi bạn đồng ý. Bạn không đồng ý thì cán bộ phường đối chiếu giấy tờ trực tiếp.',
        },
      ],
    },
    {
      id: 'nguoi-xem',
      title: 'Ai được xem dữ liệu của bạn',
      blocks: [
        {
          kind: 'table',
          head: ['Ai', 'Xem được gì'],
          rows: [
            [
              'Cán bộ phường',
              'Hồ sơ, giấy tờ và hợp đồng của hộ kinh doanh trong phường mình, và nhật ký xử lý liên quan.',
            ],
            [
              'Quản trị nền tảng',
              'Dữ liệu vận hành chung. Không xem giấy tờ định danh trong hồ sơ hộ kinh doanh.',
            ],
            [
              'Người mua và khách',
              'Chỉ thông tin công khai của quán: tên, vị trí, giấy phép còn hiệu lực, bảng giá, đánh giá.',
            ],
            [
              'Hộ kinh doanh',
              'Dữ liệu của chính hộ. Khi bị báo cáo, không biết người báo cáo là ai.',
            ],
            [
              'Người dùng khác',
              'Không xem được dữ liệu của bạn. Ảnh công khai (món, ô, ảnh đại diện) đã được xoá thông tin ẩn như vị trí chụp.',
            ],
          ],
        },
        {
          kind: 'p',
          text: 'Giấy tờ định danh và biên lai không có địa chỉ công khai: mỗi lần mở đều được kiểm tra quyền.',
        },
      ],
    },
    {
      id: 'ben-xu-ly',
      title: 'Bên xử lý dữ liệu',
      blocks: [
        {
          kind: 'p',
          text: 'StreetBiz dùng các nhà cung cấp dưới đây, chỉ gửi phần dữ liệu cần cho đúng tính năng bạn dùng.',
        },
        {
          kind: 'table',
          head: ['Bên', 'Dùng để', 'Dữ liệu gửi'],
          rows: [
            ['SpeedSMS', 'Gửi mã OTP', 'Số điện thoại và nội dung tin nhắn OTP.'],
            ['FPT.AI', 'Nhận dạng ảnh CCCD (eKYC), chỉ khi bạn đồng ý', 'Ảnh giấy tờ.'],
            [
              'Google (Gemini) và Groq',
              'Trợ lý AI: trả lời, đọc ảnh, hội thoại bằng giọng nói',
              'Câu hỏi, ảnh bạn gửi, luồng âm thanh trong phiên nói.',
            ],
            ['payOS, MoMo', 'Thanh toán', 'Mã đơn, số tiền, nội dung chuyển khoản.'],
            ['Expo', 'Thông báo đẩy trên ứng dụng', 'Mã thiết bị và nội dung thông báo.'],
            ['Vercel', 'Lưu trữ giao diện web', 'Dữ liệu kỹ thuật của yêu cầu truy cập.'],
          ],
        },
        {
          kind: 'note',
          tone: 'warn',
          title: 'Chuyển dữ liệu ra nước ngoài',
          text: 'Google, Groq, Expo và Vercel có thể xử lý dữ liệu tại máy chủ ngoài Việt Nam. Nếu bạn không muốn, hãy không dùng trợ lý AI và thông báo đẩy; các chức năng chính của StreetBiz vẫn dùng được.',
        },
      ],
    },
    {
      id: 'luu-tru',
      title: 'Thời gian lưu',
      blocks: [
        {
          kind: 'table',
          head: ['Dữ liệu', 'Lưu bao lâu'],
          rows: [
            [
              'Lịch sử chat với trợ lý AI',
              '30 ngày kể từ lần trao đổi, rồi tự xoá. Bạn xoá sớm hơn được; cuộc trò chuyện đã xoá được dọn hẳn trong ngày.',
            ],
            [
              'Âm thanh giọng nói',
              'Không lưu. Chỉ phụ đề của cuộc nói được lưu theo chính sách lịch sử chat ở trên.',
            ],
            ['Phiên đăng nhập', 'Tối đa 30 ngày không hoạt động; đăng xuất thì kết thúc ngay.'],
            [
              'Hồ sơ, hợp đồng, giấy phép, hoá đơn, biên lai, biên bản',
              'Trong thời gian cần thiết cho quản lý hành chính và nghĩa vụ lưu trữ theo quy định của pháp luật.',
            ],
          ],
        },
      ],
    },
    {
      id: 'bao-mat',
      title: 'Cách StreetBiz bảo vệ dữ liệu',
      blocks: [
        {
          kind: 'list',
          items: [
            'Truyền dữ liệu qua HTTPS. Mật khẩu và mã OTP lưu dạng băm.',
            'Khoá kết nối thanh toán của Phường và quán được mã hoá khi lưu và không bao giờ hiển thị lại.',
            'Phân quyền theo vai trò và theo phường, kiểm tra ở máy chủ cho từng yêu cầu.',
            'Thao tác của cán bộ trên hồ sơ được ghi nhật ký.',
            'Ảnh công khai được xử lý lại để xoá vị trí chụp; ảnh minh chứng được nén và xoá thông tin ẩn trước khi lưu.',
            'Giới hạn tần suất xin OTP, đăng nhập và gửi báo cáo để chống lạm dụng.',
            'Nếu xảy ra sự cố ảnh hưởng dữ liệu cá nhân, StreetBiz xử lý và thông báo theo quy định của pháp luật.',
          ],
        },
      ],
    },
    {
      id: 'quyen',
      title: 'Quyền của bạn',
      blocks: [
        {
          kind: 'p',
          text: 'Theo Luật Bảo vệ dữ liệu cá nhân 2025, bạn có các quyền như được biết, đồng ý hoặc rút lại đồng ý, truy cập, chỉnh sửa, xoá, hạn chế xử lý và phản đối.',
        },
        {
          kind: 'table',
          head: ['Việc bạn muốn', 'Làm thế nào'],
          rows: [
            ['Xem và cập nhật thông tin tài khoản', 'Mục Tài khoản trong ứng dụng.'],
            ['Đăng xuất khỏi thiết bị khác, xem lịch sử đăng nhập', 'Mục Tài khoản, phần Bảo mật.'],
            ['Xoá lịch sử chat với trợ lý', 'Trong khung trợ lý, xoá từng cuộc trò chuyện.'],
            [
              'Tắt nhận diện CCCD tự động',
              'Không đồng ý ở bước eKYC; cán bộ phường đối chiếu giấy tờ trực tiếp.',
            ],
            [
              'Xoá tài khoản, xuất bản sao dữ liệu, chỉnh sửa dữ liệu hồ sơ đã nộp',
              'Hiện chưa có nút trong ứng dụng. Gửi yêu cầu tới Phường nơi bạn đăng ký; yêu cầu được xử lý trong thời hạn pháp luật quy định. Dữ liệu hồ sơ phải lưu theo quy định có thể chưa xoá được.',
            ],
          ],
        },
      ],
    },
    {
      id: 'thiet-bi',
      title: 'Dữ liệu lưu trên thiết bị của bạn',
      blocks: [
        {
          kind: 'list',
          items: [
            'Web lưu mã phiên đăng nhập và vài tuỳ chọn giao diện trong bộ nhớ của trình duyệt. Ứng dụng di động lưu mã phiên trong kho bảo mật của hệ điều hành.',
            'StreetBiz không dùng cookie quảng cáo hay công cụ phân tích hành vi.',
            'Xoá dữ liệu trình duyệt hoặc đăng xuất sẽ xoá các mục này.',
          ],
        },
      ],
    },
    {
      id: 'lien-he',
      title: 'Liên hệ và khiếu nại',
      blocks: [
        {
          kind: 'list',
          items: [
            'Câu hỏi hoặc yêu cầu về dữ liệu: gửi tới cán bộ Phường nơi bạn đăng ký. Thông tin liên hệ của Phường hiện ở trang chi tiết tuyến, trong mục thông tin tuyến.',
            'Nếu cho rằng dữ liệu của mình bị xử lý trái pháp luật, bạn có quyền khiếu nại, tố cáo hoặc khởi kiện, và phản ánh tới cơ quan chuyên trách bảo vệ dữ liệu cá nhân của Bộ Công an.',
          ],
        },
        {
          kind: 'p',
          text: 'Chính sách này có thể được cập nhật khi hệ thống hoặc pháp luật thay đổi; ngày cập nhật ghi ở đầu trang.',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// Quy định thuê ô vỉa hè
// ---------------------------------------------------------------------------------------------

export const SLOT_RULES: LegalDocument = {
  title: 'Quy định thuê ô vỉa hè',
  summary: 'Điều kiện, quy trình, chi phí và nghĩa vụ khi bạn thuê một ô vỉa hè trên StreetBiz.',
  updatedAt: UPDATED,
  highlights: [
    'Nộp đơn khi hồ sơ kinh doanh còn đang chờ duyệt vẫn được, nhưng chỉ được duyệt thuê khi hồ sơ đã được duyệt.',
    'Giữ chỗ một ô trong 15 phút, tối đa 3 ô cùng lúc; hết giờ ô tự trả lại.',
    'Số tiền trên đơn là ước tính; giá chính thức chốt theo giá tuyến lúc Phường duyệt.',
    'Còn nợ phí quá hạn hoặc tiền phạt chưa nộp thì không gia hạn, trả ô hay chuyển nhượng được.',
  ],
  sections: [
    {
      id: 'quy-trinh',
      title: 'Quy trình từ nộp đơn đến bán hàng',
      blocks: [
        {
          kind: 'steps',
          items: [
            'Chọn ô còn trống trên bản đồ, xem giá và quy định của tuyến; có thể giữ chỗ 15 phút để cân nhắc.',
            'Chọn thời hạn thuê, xem báo giá, tích đồng ý cam kết và nộp đơn.',
            'Phường xem xét. Đơn có thể được duyệt, bị từ chối kèm lý do hoặc cần bổ sung thông tin; bạn theo dõi trạng thái trong mục Đơn thuê và có thể rút đơn khi chưa duyệt.',
            'Khi Phường duyệt, hợp đồng, lịch đóng phí và giấy phép QR được tạo.',
            'Đóng phí đúng hạn, treo giấy phép QR và bảng giá tại quầy, bán hàng đúng vị trí và khung giờ.',
          ],
        },
      ],
    },
    {
      id: 'dieu-kien',
      title: 'Điều kiện nộp đơn',
      blocks: [
        {
          kind: 'list',
          items: [
            'Có tài khoản hộ kinh doanh và hồ sơ kinh doanh. Có thể nộp đơn khi hồ sơ đang chờ duyệt, nhưng Phường chỉ duyệt thuê khi hồ sơ đã được duyệt.',
            'Mỗi ô chỉ có một đơn đang xử lý tại một thời điểm.',
            'Mỗi khu (tuyến) có thể có hạn nộp đơn. Qua hạn, Phường không nhận đơn mới ở khu đó, các hợp đồng đang chạy không bị ảnh hưởng.',
            'Ô liền kề cửa hàng chỉ dành cho hộ có cửa hàng cố định, nằm trong bán kính quy định quanh địa chỉ cửa hàng (hiện là 150 m). Mỗi hộ chỉ có một hợp đồng ô liền kề đang hiệu lực.',
            'Ô nằm ở vị trí bị Phường cấm kinh doanh (ví dụ trạm biến áp) không thuê được.',
          ],
        },
      ],
    },
    {
      id: 'cam-ket',
      title: 'Cam kết khi kinh doanh',
      blocks: [
        {
          kind: 'p',
          text: 'Khi nộp đơn bạn đồng ý với hai cam kết sau. Hệ thống lưu việc bạn đã đồng ý và thời điểm đồng ý.',
        },
        { kind: 'list', items: [...SLOT_COMMITMENTS] },
      ],
    },
    {
      id: 'giu-cho',
      title: 'Giữ chỗ',
      blocks: [
        {
          kind: 'list',
          items: [
            'Bạn có thể giữ một ô còn trống trong 15 phút để cân nhắc. Trong lúc đó người khác không nộp đơn vào ô này được.',
            'Mỗi hồ sơ giữ tối đa 3 ô cùng lúc. Giữ lại để gia hạn thời gian giữ.',
            'Hết thời gian, ô tự trả lại cho người khác. Nộp đơn xong, lượt giữ của bạn tự được thả.',
          ],
        },
      ],
    },
    {
      id: 'bao-gia',
      title: 'Cách tính tiền',
      blocks: [
        {
          kind: 'list',
          items: [
            'Ô cố định thuê theo tháng (1, 3, 6 hoặc 12 tháng); khu sự kiện thuê theo ngày.',
            'Thuê 3, 6 hoặc 12 tháng (tròn quý) được giảm theo mức của từng tuyến, nếu tuyến có áp dụng.',
          ],
        },
        {
          kind: 'table',
          head: ['Khoản', 'Cách tính'],
          rows: [
            [
              'Tiền thuê',
              'Giá của tuyến (hoặc giá riêng của ô nếu Phường đặt) nhân với thời hạn thuê.',
            ],
            [
              'Giảm theo quý',
              'Phần trăm của tuyến, trừ vào tiền thuê. Chỉ áp dụng cho thời hạn tròn quý.',
            ],
            [
              'Phụ phí',
              'Tính theo ngày, theo kỳ hoặc một lần, tuỳ từng khoản của tuyến. Khoản ghi "tham khảo" chưa tính vào hợp đồng.',
            ],
            [
              'Tiền cọc',
              'Thu một lần ở hợp đồng đầu tiên, không tính là phí và được hoàn lại khi kết thúc hợp đồng.',
            ],
          ],
        },
        {
          kind: 'note',
          tone: 'warn',
          title: 'Số tiền trên đơn chỉ là ước tính',
          text: 'Giá chính thức chốt theo giá tuyến tại thời điểm Phường duyệt. Lịch đóng phí chỉ có sau khi đơn được duyệt.',
        },
      ],
    },
    {
      id: 'duyet',
      title: 'Duyệt đơn và hợp đồng',
      blocks: [
        {
          kind: 'list',
          items: [
            'Cần có hồ sơ kinh doanh đã được duyệt. Cán bộ phường quyết định duyệt, từ chối kèm lý do hoặc yêu cầu bổ sung.',
            'Khi Phường duyệt đơn, hợp đồng và giấy phép QR được tạo tự động; ô chuyển sang trạng thái đã thuê.',
            'Phí chia thành các kỳ 30 ngày, mỗi kỳ đến hạn vào ngày kỳ đó bắt đầu. Kỳ đầu gồm cả tiền cọc và các khoản thu một lần.',
            'Phường quyết định theo thẩm quyền của mình. Trợ lý AI chỉ gợi ý, không quyết định.',
          ],
        },
      ],
    },
    {
      id: 'dong-phi',
      title: 'Đóng phí',
      blocks: [
        {
          kind: 'list',
          items: [
            'Mỗi kỳ có hạn đóng ghi trong lịch phí của hợp đồng; bạn được nhắc khi còn 3 ngày đến hạn.',
            'Quá hạn, kỳ phí chuyển sang trạng thái quá hạn và Phường có thể nhắc thêm, mỗi hộ một lần mỗi ngày.',
            'Trả bằng chuyển khoản VietQR vào tài khoản của Phường (khi Phường đã kết nối payOS). Hệ thống tự xác nhận khi tiền về và xuất hoá đơn trong mục Tài chính.',
            'Hợp đồng còn kỳ phí quá hạn hoặc tiền phạt chưa nộp không gia hạn, trả hay chuyển nhượng được.',
          ],
        },
      ],
    },
    {
      id: 'gia-han-tra-o',
      title: 'Gia hạn và trả ô',
      blocks: [
        {
          kind: 'list',
          items: [
            'Gia hạn: gửi yêu cầu gia hạn trong mục Hợp đồng. Phường xử lý trong thời hạn quy định (hiện áp dụng 3 ngày làm việc).',
            'Trả ô: gửi yêu cầu trả ô khi đã hết nợ. Sau khi trả, các kỳ phí chưa đến hạn không còn phải đóng và ô được mở lại cho người khác.',
            'Hợp đồng hết hạn mà không gia hạn thì giấy phép QR hết hiệu lực; bạn không được tiếp tục bán tại ô đó.',
          ],
        },
      ],
    },
    {
      id: 'thay-doi-o',
      title: 'Chuyển nhượng, đổi địa chỉ, đề xuất ô mới',
      blocks: [
        {
          kind: 'list',
          items: [
            'Chuyển nhượng: bạn gửi yêu cầu cho hộ nhận (nhập số điện thoại của họ). Hộ nhận phải có hồ sơ kinh doanh đã được duyệt và đồng ý; Phường duyệt thì quyền thuê mới chuyển sang họ.',
            'Đổi địa chỉ kinh doanh: gửi yêu cầu kèm địa chỉ mới; Phường duyệt.',
            'Đề xuất ô mới tại địa chỉ chưa có trên lưới của Phường: kèm ảnh vị trí và kích thước. Đề xuất trùng hoặc chồng lấn một ô đã có sẽ bị từ chối; Phường duyệt thì ô mới mới xuất hiện để thuê.',
          ],
        },
      ],
    },
    {
      id: 'niem-yet-gia',
      title: 'Niêm yết giá và giấy phép',
      blocks: [
        {
          kind: 'list',
          items: [
            'Treo giấy phép QR còn hiệu lực tại quầy để người mua và cán bộ kiểm tra được.',
            'Với quầy bán món ăn, thức uống: niêm yết giá (bảng giá có mã QR) và bán đúng giá niêm yết. Người mua có thể báo cáo khi bị tính cao hơn niêm yết hoặc quầy không treo bảng giá.',
            'Phường xử lý báo cáo bằng cách hoà giải, ghi nhận vi phạm hoặc bác bỏ nếu không có căn cứ, và thông báo kết quả cho cả hai bên.',
          ],
        },
      ],
    },
    {
      id: 'vi-pham',
      title: 'Vi phạm và xử lý',
      blocks: [
        {
          kind: 'p',
          text: 'Vi phạm cam kết có thể bị lập biên bản, phạt tiền, tạm ngưng hoặc thu hồi giấy phép theo khung xử phạt của Phường.',
        },
        {
          kind: 'steps',
          items: [
            'Cán bộ phường ghi nhận vi phạm (kiểm tra tại chỗ hoặc từ báo cáo) kèm bằng chứng và lập biên bản.',
            'Bạn được giải trình: trong 2 ngày làm việc nếu giải trình trực tiếp, 5 ngày làm việc nếu bằng văn bản, khi vụ việc thuộc diện phải giải trình.',
            'Phường ra quyết định xử phạt theo biểu mức phạt do Phường công bố. Bạn xem mức phạt của Phường ngay trong mục Lịch sử vi phạm.',
            'Bạn nộp tiền phạt vào Kho bạc Nhà nước và tải biên lai lên StreetBiz. Phường xác nhận hoặc từ chối kèm lý do.',
          ],
        },
        {
          kind: 'note',
          tone: 'info',
          title: 'Quyền của bạn',
          text: 'Bạn có quyền khiếu nại, tố cáo hoặc khởi kiện quyết định xử phạt theo quy định của pháp luật. Nếu quyết định bị huỷ sau khi bạn đã nộp phạt, Kho bạc Nhà nước hoàn tiền theo quy định.',
        },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------------------------
// Căn cứ pháp lý
// ---------------------------------------------------------------------------------------------

export const LEGAL_BASIS: LegalDocument = {
  title: 'Căn cứ pháp lý',
  summary:
    'Các văn bản pháp luật StreetBiz dựa vào, theo từng nội dung. Thông tin tham khảo, không thay thế tư vấn pháp lý.',
  updatedAt: UPDATED,
  highlights: [
    'Việc cho phép dùng hè phố kinh doanh thuộc thẩm quyền của chính quyền địa phương; StreetBiz chỉ hỗ trợ thực hiện thủ tục.',
    'Thủ tục trên StreetBiz không thay thế đăng ký hộ kinh doanh khi pháp luật yêu cầu.',
    'Tiền phạt nộp Kho bạc Nhà nước; phí thuê ô nộp theo quy định về phí, lệ phí.',
    'Văn bản pháp luật có thể thay đổi: luôn đối chiếu văn bản đang có hiệu lực.',
  ],
  sections: [
    {
      id: 'tuyen',
      title: 'Tuyến cho thuê ô',
      blocks: [
        {
          kind: 'p',
          text: 'Mỗi tuyến chỉ được mở cho thuê khi có văn bản cho phép của cơ quan có thẩm quyền ở địa phương. Số hiệu văn bản ghi trong thông tin tuyến và hiện khi bạn rê chuột vào mục Căn cứ pháp lý của tuyến đó.',
        },
      ],
    },
    {
      id: 'duyet-ho-so',
      title: 'Thẩm quyền và thời hạn duyệt hồ sơ',
      blocks: [
        {
          kind: 'table',
          head: ['Văn bản', 'Nội dung liên quan'],
          rows: [
            [
              'Luật Trật tự, an toàn giao thông đường bộ 2024 (Luật số 36/2024/QH15), Điều 77',
              'Sử dụng tạm thời lòng đường, vỉa hè vào mục đích khác: vỉa hè dành cho người đi bộ, việc sử dụng cho mục đích khác phải bảo đảm trật tự, an toàn giao thông.',
            ],
            [
              'Luật Đường bộ 2024 (Luật số 35/2024/QH15)',
              'Quản lý, bảo vệ kết cấu hạ tầng đường bộ, trong đó có vỉa hè.',
            ],
            [
              'Nghị định 165/2024/NĐ-CP ngày 26/12/2024, Điều 21',
              'Trình tự, thủ tục, thẩm quyền cho phép sử dụng tạm thời lòng đường, vỉa hè vào mục đích khác.',
            ],
            [
              'Nghị định 241/2026/NĐ-CP ngày 26/06/2026 (hiệu lực 01/07/2026)',
              'Sửa đổi, bổ sung một số điều của Nghị định 165/2024/NĐ-CP. StreetBiz áp dụng hạn xử lý hồ sơ gia hạn 3 ngày làm việc theo các quy định này.',
            ],
            [
              'Luật Phí và lệ phí 2015 (Luật số 97/2015/QH13)',
              'Thẩm quyền và cách thu phí nộp ngân sách nhà nước.',
            ],
          ],
        },
        {
          kind: 'p',
          text: 'Các trường hợp liệt kê tại Điều 21 Nghị định 165/2024/NĐ-CP chủ yếu là trường hợp phi thương mại (sự kiện, tang lễ, thi công…), không trực tiếp bao gồm kinh doanh hàng hoá. Vì vậy, việc cho thuê hè phố để bán hàng ở từng tuyến cần có quyết định riêng của chính quyền địa phương; StreetBiz không tự cấp quyền đó.',
        },
      ],
    },
    {
      id: 'cap-phuong',
      title: 'Thẩm quyền cấp phường đối với hộ kinh doanh',
      blocks: [
        {
          kind: 'p',
          text: 'Theo Nghị định 168/2025/NĐ-CP ngày 30/06/2025 (có hiệu lực từ 01/07/2025, thay Nghị định 01/2021/NĐ-CP) và mô hình chính quyền địa phương hai cấp, việc đăng ký hộ kinh doanh thuộc cơ quan đăng ký kinh doanh cấp xã (Phòng Kinh tế hoặc Phòng Kinh tế, Hạ tầng và Đô thị thuộc UBND phường, xã), không còn cấp quận, huyện.',
        },
        {
          kind: 'note',
          tone: 'info',
          title: 'Thủ tục trên StreetBiz không thay đăng ký hộ kinh doanh',
          text: 'Việc thẩm định điểm bán vỉa hè xác nhận điều kiện trật tự đô thị, an toàn giao thông và vệ sinh môi trường tại địa bàn phường. Hộ kinh doanh thuộc diện phải đăng ký vẫn đăng ký riêng, theo Mẫu số 01 (giấy đề nghị đăng ký hộ kinh doanh) ban hành kèm Thông tư 68/2025/TT-BTC.',
        },
      ],
    },
    {
      id: 'kinh-doanh',
      title: 'Đăng ký kinh doanh vỉa hè',
      blocks: [
        {
          kind: 'list',
          items: [
            'Nghị định 168/2025/NĐ-CP (Điều 82, khoản 3): người bán hàng rong, quà vặt, kinh doanh lưu động, thời vụ được miễn đăng ký hộ kinh doanh, trừ trường hợp kinh doanh ngành, nghề đầu tư kinh doanh có điều kiện. Nội dung này thay cho quy định tương tự tại Nghị định 01/2021/NĐ-CP trước đây.',
            'Ngành có điều kiện như đồ ăn, thức uống vẫn phải đáp ứng điều kiện riêng; trên StreetBiz, điều kiện đó là cam kết an toàn thực phẩm.',
            'Hộ chọn đăng ký tự nguyện kê khai theo Mẫu số 01 ban hành kèm Thông tư 68/2025/TT-BTC.',
          ],
        },
      ],
    },
    {
      id: 'du-lieu',
      title: 'Dữ liệu cá nhân và eKYC',
      blocks: [
        {
          kind: 'table',
          head: ['Văn bản', 'Nội dung liên quan'],
          rows: [
            [
              'Luật Bảo vệ dữ liệu cá nhân 2025 (Luật số 91/2025/QH15), hiệu lực 01/01/2026',
              'Nguyên tắc xử lý, quyền của chủ thể dữ liệu, dữ liệu cá nhân nhạy cảm, chuyển dữ liệu ra nước ngoài.',
            ],
            [
              'Nghị định 356/2025/NĐ-CP ngày 31/12/2025 (hiệu lực 01/01/2026, thay Nghị định 13/2023/NĐ-CP)',
              'Hướng dẫn chi tiết Luật: điều kiện đồng ý, bảo vệ dữ liệu nhạy cảm, chuyển dữ liệu qua biên giới.',
            ],
          ],
        },
        {
          kind: 'p',
          text: 'Việc nhận dạng ảnh CCCD và đối chiếu khuôn mặt chỉ thực hiện khi bạn đồng ý riêng. Không đồng ý vẫn nộp hồ sơ được, cán bộ phường đối chiếu giấy tờ trực tiếp. Chi tiết xem Chính sách bảo mật.',
        },
      ],
    },
    {
      id: 'xu-phat',
      title: 'Trật tự hè phố và xử phạt',
      blocks: [
        {
          kind: 'table',
          head: ['Văn bản', 'Nội dung liên quan'],
          rows: [
            [
              'Luật Xử lý vi phạm hành chính 2012 (sửa đổi, bổ sung 2020), Điều 61 và Điều 78',
              'Giải trình khi bị xử phạt (Điều 61) và nộp tiền phạt vào Kho bạc Nhà nước (Điều 78).',
            ],
            [
              'Nghị định 118/2021/NĐ-CP',
              'Hướng dẫn Luật Xử lý vi phạm hành chính: lập biên bản, trình tự xử phạt.',
            ],
            [
              'Nghị định 168/2024/NĐ-CP',
              'Xử phạt vi phạm hành chính về trật tự, an toàn giao thông đường bộ, trong đó có hành vi lấn chiếm hè phố.',
            ],
          ],
        },
        {
          kind: 'list',
          items: [
            'Mức phạt cụ thể và căn cứ của từng hành vi do Phường công bố trong biểu mức phạt; bạn xem được trong mục Lịch sử vi phạm.',
            'Tiền phạt là khoản thu ngân sách nhà nước: bạn nộp vào Kho bạc Nhà nước, StreetBiz không thu hộ.',
            'Ngưỡng 1,5 m phần hè còn lại cho người đi bộ mà hệ thống dùng để cảnh báo là ngưỡng vận hành mặc định của StreetBiz, không phải con số trích từ một điều luật cụ thể.',
          ],
        },
      ],
    },
  ],
};
