import json
import time
import os
import sys

try:
    import requests
    from playwright.sync_api import sync_playwright
except ImportError:
    print("❌ 缺少必要的依赖库！")
    print("请先在终端运行以下命令安装依赖：")
    print("    pip install requests playwright")
    print("    playwright install chromium")
    sys.exit(1)

def grab_dynamic_headers_and_cookies():
    """使用 Playwright 隐式打开本机的 Edge 以抓取 x-edu-signature 并自动提取有效 Cookie"""
    print("[*] 正在绕过最新的浏览器 v20 加密保护...")
    print("[*] 正在静默拉起你的 Edge 身份引擎探测签名 (这可能需要几秒)...")
    
    user_data_path = os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\Edge\User Data")
    
    # 从配置文件中读取 Edge 路径
    config_file = "config.json"
    edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    if os.path.exists(config_file):
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config = json.load(f)
                edge_path = config.get("edge_path", edge_path)
        except Exception:
            pass
    
    try:
        with sync_playwright() as p:
            # 方案二：利用 launch_persistent_context 直接套用你本机的真实 Edge 账号数据启动。
            # 如果你此时开着相同配置的 Edge 可能会报错文件占用，你已经关闭了所以可以通杀加密。
            ctx = p.chromium.launch_persistent_context(
                user_data_dir=user_data_path,
                executable_path=edge_path,
                headless=True
            )
            
            page = ctx.new_page()
            captured = {}
            
            def handle_request(req):
                if 'x-edu-signature' in req.headers:
                    captured['x-edu-signature'] = req.headers['x-edu-signature']
                    captured['x-edu-timestamp'] = req.headers.get('x-edu-timestamp')
                    captured['pc-authorization'] = req.headers.get('pc-authorization')
            
            page.on("request", handle_request)
            page.goto('https://www.educoder.net/', wait_until='domcontentloaded')
            
            # 等待前端生成并携带签名发出请求
            for _ in range(10):
                if 'x-edu-signature' in captured:
                    break
                page.wait_for_timeout(500)
            
            # 直接在这个成功登录的引擎里获取已经自动解密的有效 Cookie 字典
            all_cookies = ctx.cookies("https://www.educoder.net")
            cookie_parts = []
            for c in all_cookies:
                if c['name'] in ['autologin_trustie', '_educoder_session']:
                    cookie_parts.append(f"{c['name']}={c['value']}")
            
            captured['cookie'] = "; ".join(cookie_parts)
            
            page.close()
            ctx.close()
            
            if 'x-edu-signature' in captured and captured['cookie']:
                print("✅ 成功利用原生浏览器破除了加密，并拿到了 Cookie 与最新签名!")
                return captured
            else:
                print("❌ 虽然启动了浏览器，但未能在页面全加载时截获到登录数据。你确认你用 Edge 登录过头歌吗？")
                return None
                
    except Exception as e:
        err_msg = str(e)
        if "lock" in err_msg.lower() or "used by another process" in err_msg.lower() or "pass --user-data-dir" in err_msg.lower():
            print(f"\n❌ [引擎占用冲突] Playwright 无法动用你的配置档，因为底层数据库被锁定了！")
            print("👉 这是因为后台还有 Edge 进程。打开任务管理器把所有 msedge.exe 结束掉（可使用taskkill /F /IM msedge.exe），保证 Edge 完全关闭后再运行脚本。")
        else:
            print(f"无法启动浏览器获取签名，错误: {e}")
        return None

CACHE_FILE = "auth_cache.json"

def build_headers(referer: str, dynamic_headers: dict) -> dict:
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
        "Connection": "keep-alive",
        "Content-Type": "application/json; charset=utf-8",
        # 此时 dynamic_headers 必定含有 cookie
        "Cookie": dynamic_headers.get('cookie', '') if dynamic_headers else '',
        "Host": "data.educoder.net",
        "Origin": "https://www.educoder.net",
        "Pc-Authorization": dynamic_headers.get('pc-authorization', '') if dynamic_headers else '',
        "Referer": referer,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0",
        "X-EDU-Type": "pc",
        "X-Original-Host": "www.educoder.net",
        "X-Original-Origin": "https://www.educoder.net",
        "X-Original-Protocol": "https:",
    }

    if dynamic_headers:
        headers["X-EDU-Timestamp"] = dynamic_headers.get('x-edu-timestamp', '')
        headers["X-EDU-Signature"] = dynamic_headers.get('x-edu-signature', '')
    else:
        # 回退模拟（可能会鉴权失败）
        headers["X-EDU-Timestamp"] = str(int(time.time() * 1000))

    return headers


def get_student_id(headers):
    url = "https://data.educoder.net/api/users/get_user_info.json?course_id=ha7123gp&school=1"
    response = requests.get(url, headers=headers)
    # print(f"Response Status Code: {response.status_code}")
    response_content = response.content.decode('utf-8')
    # print(f"Response Content: {response_content}")
    if response.status_code == 200:
        data = response.json()
        return data.get('login')
    return None

print("[*] 正在准备并校验全局登录凭证...")
global_dynamic_headers = None
if os.path.exists(CACHE_FILE):
    try:
        with open(CACHE_FILE, 'r', encoding='utf-8') as f:
            global_dynamic_headers = json.load(f)
    except Exception:
        pass

# 尝试从缓存读取 student_id
student_id = global_dynamic_headers.get('student_id') if global_dynamic_headers else None

# 如果缓存为空，或缓存里没有存过 student_id
if not global_dynamic_headers or not student_id:
    if not global_dynamic_headers:
        global_dynamic_headers = grab_dynamic_headers_and_cookies()
        
    if global_dynamic_headers:
        test_headers = build_headers("https://www.educoder.net/classrooms", global_dynamic_headers)
        student_id = get_student_id(test_headers)
        
        # 如果请求不到 student_id，大概率是旧的 cookie 缓存过期了，需要重新全自动抓取
        if not student_id:
            print("[!] 抓取 student_id 失败，缓存可能已失效。正在重新开启浏览器拉取最新凭证...")
            global_dynamic_headers = grab_dynamic_headers_and_cookies()
            if global_dynamic_headers:
                test_headers = build_headers("https://www.educoder.net/classrooms", global_dynamic_headers)
                student_id = get_student_id(test_headers)
        
        # 获取到以后，追加进字典里永久化保存至 JSON 缓存中
        if student_id and global_dynamic_headers:
            global_dynamic_headers['student_id'] = student_id
            with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                json.dump(global_dynamic_headers, f)

if not student_id:
    print("❌ 无法获取有效的学生ID，请检查是否在 Edge 浏览器中正常登录了头歌官网！")
    sys.exit(1)

print(f"✅ 成功提取当前账户身份标识 (student_id): {student_id}\n")

# 从配置文件读取课程列表
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(SCRIPT_DIR, "courses_config.json")
courses = []
if os.path.exists(CONFIG_FILE):
    try:
        with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
            courses = json.load(f)
    except Exception as e:
        print(f"❌ 读取配置文件 {CONFIG_FILE} 失败: {e}")
        sys.exit(1)
else:
    print(f"❌ 缺少配置文件 {CONFIG_FILE}！")
    sys.exit(1)

switcher = {}
for course in courses:
    course_id = course.get("course_id")
    course_name = course.get("course_name")
    if not course_id or not course_name:
        continue
    
    # 【图文作业】api的url
    picture_url = f'https://data.educoder.net/api/courses/{course_id}/homework_commons.json?coursesId={course_id}&id={course_id}&limit=20&type=1&zzud={student_id}'
    switcher[picture_url] = f"{course_name}_PictureHomework"
    
    # 【课堂实验】api的url
    classwork_url = f'https://data.educoder.net/api/courses/{course_id}/homework_commons.json?limit=20&status=0&id={course_id}&type=4&order=0&zzud={student_id}'
    switcher[classwork_url] = f"{course_name}_Classwork"

# 使用for循环遍历switcher进行爬虫
success = False
for chosen_url in switcher.keys():
    print(f"正在爬取: {chosen_url}")
    # 确保能通过修改过的 url 匹配到前缀
    # switcher[chosen_url] = switcher.get(chosen_url, 'result')

    file_prefix = switcher.get(chosen_url, 'result')  # 默认值为 'result'
    result_file = f'{file_prefix}_result.json'

    dynamic_headers = None

    # 第一优先：从缓存文件加载签名与 Cookie，无需每次拉起浏览器
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                dynamic_headers = json.load(f)
                print(f"[*] 发现本地缓存依赖，已加载历史签名...")
        except Exception:
            pass

    for attempt in range(2): # 尝试利用缓存请求，如果失效则拉起 Playwright 重新抓取 1 次
        if not dynamic_headers:
            dynamic_headers = grab_dynamic_headers_and_cookies()
            if dynamic_headers:
                # 重新抓取时别忘了把之前拿到的 student_id 补回去，以免缓存丢失这段数据
                if 'student_id' in locals() and student_id:
                    dynamic_headers['student_id'] = student_id
                with open(CACHE_FILE, 'w', encoding='utf-8') as f:
                    json.dump(dynamic_headers, f)
            else:
                break

        headers = build_headers("https://www.educoder.net/", dynamic_headers)
        
        all_homeworks = []
        current_page = 1
        first_page_data = None
        auth_failed = False
        
        while True:
            # 给 URL 加上 page 参数（不管是否有原 page 我们直接 &page=x）
            sep = '&' if '?' in chosen_url else '?'
            page_url = f"{chosen_url}{sep}page={current_page}"
            print(f"[*] 正在请求第 {current_page} 页: {page_url}")
            
            response = requests.get(page_url, headers=headers, timeout=20)
            data = response.json()
            
            if isinstance(data, dict) and data.get("status") in [-102, 401]:
                auth_failed = True
                break
                
            if first_page_data is None:
                first_page_data = data
                
            if 'homeworks' in data and isinstance(data['homeworks'], list):
                all_homeworks.extend(data['homeworks'])
                
            total_count = data.get("query_total_count", 0)
            
            # 如果返回没数据了，或者总量已经符合期望，则停止请求下一页
            if 'homeworks' not in data or not data['homeworks']:
                break
                
            if len(all_homeworks) >= total_count:
                break
                
            current_page += 1

        if auth_failed:
            print("\n[!] 鉴权失败：签名或Cookie已失效。将清空缓存重新拉取实时凭证并全自动解密重试...\n")
            dynamic_headers = None # 置空，触发下一次循环拉起浏览器重新获取
            if os.path.exists(CACHE_FILE):
                os.remove(CACHE_FILE)
            continue
        
        # 鉴权成功，并且所有分页已经抓取完毕
        # 把合并好的全部分页作业列表塞入最初的数据骨架里
        first_page_data["homeworks"] = all_homeworks
        data = first_page_data
        success = True
        break # 成功则退出最外层尝试循环

    if success and 'data' in locals() and not (isinstance(data, dict) and data.get("status") in [-102, 401]):
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
            print(f"✅ 结果已写入: {result_file} （已实现自动分页！共提取 {len(data.get('homeworks', []))} 项作业记录）")

if not success:
    print("❌ 爬虫执行失败：无法获取有效的作业数据。")
    sys.exit(1)
        
