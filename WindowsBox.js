/*
 * 窗口容器
 * @author： 黄
 * 2019.4.19
 */
const {app, BrowserWindow, webContents} = require('electron')
const path = require('path')

/*
 * 修正现在开始在主进程创建
 * 并且窗口容器用以数字id为对象属性的对象来实现
 * 数组在多进程下会出问题
 */

class WindowsBox {
  constructor (config) {
    config = config || {}
    this.freeWindowNum = config.freeWindowNum || 1 // 允许空闲的窗口数量
    this.port = config.port || 9080
    this.router = '/blank'
    this._windowList = [] // 窗口容器
    this.baseWindowConfig = {
      webPreferences: { webSecurity: this.isPackaged() },
      show: false,
      transparent: false,
      frame: true,
      autoHideMenuBar: true,
      width: 0,
      height: 0
    }
    // 单例模式
    if (WindowsBox.prototype.__Instance === undefined) {
      WindowsBox.prototype.__Instance = this
      this.checkFreeWindow()
    }
    return WindowsBox.prototype.__Instance
  }

  /*
   * 打开新的空白窗口等待加载
   */
  creatFreeWindow () {
    let win = new BrowserWindow(this.baseWindowConfig)
    // 设置传参
    this._windowList.push({
      id: win.id,
      name: '',
      isUse: false,
      router: this.router,
      sendMsg: {},
      backMsg: {},
      fromId: '',
      reuse: false
    })
    let winId = win.id

    win.on('closed', () => {
      setTimeout(() => {
        // 设置未使用
        // let windowInfo = this.getWindowInfoById(winId)
        // windowInfo.isUse = false;

        // 先push出数组
        this._windowList = this._windowList.filter(row => row.id !== winId)
        // 如果只剩下空白的窗口就关掉应用
        // let allWindows = BrowserWindow.getAllWindows()
        // let _windowList = this._windowList.map(row => row.id)
        // let appShouldQuit = true
        // for (var i = allWindows.length - 1; i >= 0; i--) {
        //   let key = _windowList.indexOf(allWindows[i].id)
        //   if (allWindows[i].id != winId && (key < 0 || (key > -1 && this.getWindowInfoById(_windowList[key]).isUse))) appShouldQuit = false
        // }
        // if (appShouldQuit) app.quit()
        win = null
      }, 100)
    })

    win.on('resize', () => {
      const [width, height] = win.getContentSize()
      for (let wc of webContents.getAllWebContents()) {
        // Check if `wc` belongs to a webview in the `win` window.
        if (wc.hostWebContents &&
          wc.hostWebContents.id === win.webContents.id) {
          wc.setSize({
            normal: {
              width: width,
              height: height
            }
          })
        }
      }
    })

    let modalPath = this.isPackaged()
      ? path.join('file://', __dirname, '../../dist/') + 'index.html#' + this.router
      : 'http:localhost:' + this.port + '/index.html#' + this.router

    win.loadURL(modalPath)

    return win
  }

  /*
   * 平衡空白窗口数量
   */
  checkFreeWindow () {
    // 如果有缓存，查找空余窗口是否足够，不足的话创建到给定水平（同时删掉可能多出来的窗口）
    let notUseWindowNum = 0
    this._windowList.forEach(row => {
      if (!row.isUse) notUseWindowNum++
    })
    let num = this.freeWindowNum - notUseWindowNum
    if (num > 0) {
      for (var i = num; i > 0; i--) {
        this.creatFreeWindow() // 暂时循环调用，后期用延时
      }
    }
  }

  /*
   * 使用一个空白窗口
   * 暂时支持初始几个参数
   * {width,height,model,router}
   */
  getFreeWindow (option) {
    // 怎么配置参数
    // 怎么绑定事件
    // 暂时支持简单的参数（width，height，frame, transform等）
    option = option ? JSON.parse(option) : {}
    let freeWindow, freeWindowInfo
    // 拉出窗口
    freeWindowInfo = this.getNewWindow()
    freeWindow = BrowserWindow.fromId(freeWindowInfo.id)
    // 路由跳转
    this.windowRouterChange(freeWindow, option.windowConfig.router)
    // 窗口基础状态
    this.setWindowConfig(this.getBaseConfig(option, freeWindow), freeWindow)
    // 更新队列
    this.refreshFreeWindowInfo(freeWindowInfo, option)
    this.checkFreeWindow()
    return freeWindow
  }

  /*
   * @desc 更新队列
   */
  refreshFreeWindowInfo (freeWindowInfo, option) {
    freeWindowInfo.router = option.windowConfig.router
    freeWindowInfo.sendMsg = option.windowConfig.data || {}
    freeWindowInfo.isUse = true
    freeWindowInfo.name = option.windowConfig.name
    freeWindowInfo.fromId = option.windowConfig.fromWinId
    freeWindowInfo.reuse = option.windowConfig.reuse || false
    this.setWindowInfo(freeWindowInfo)
  }

  /*
   * @desc 获取基础配置
   * {vibrancy, width, height, minimizable, maximizable, resizable, x, y, center, alwaysOnTop, skipTaskbar}
   */
  getBaseConfig (option, freeWindow) {
    let config = {}
    config.center = true
    config.width = option.width
    config.height = option.height
    config.title = option.title
    config.minimizable = option.minimizable || true
    config.maximizable = option.maximizable || true
    config.resizable = option.resizable || true
    config.alwaysOnTop = option.alwaysOnTop || false
    config.skipTaskbar = option.skipTaskbar || false
    return config
  }

  /*
   * @desc 新窗口路由跳转option
   * @parame option {object} {win: win, name: '', data: {}, router: ''}
   */
  windowRouterChange (win, router) {
    if (win.webContents.isLoading()) {
        console.log('isLoading');
        // win.webContents.reload();
        console.log(win.webContents.getURL());
        if(win.webContents.getURL() == ""){
          console.log('URL is blank');
        }
        win.webContents.once('did-finish-load', function () {
          win.webContents.send('_changeModelPath', router)
        })
    } else {
      win.webContents.send('_changeModelPath', router)
    }
  }


  /*
   * @desc 重新设置窗口的基础属性
   * 目前需要手动调整的后期根据需求加入
   * @param {object} config:{vibrancy, width, height, minimizable, maximizable, resizable, x, y, center, alwaysOnTop, skipTaskbar}
   */
  setWindowConfig (config, freeWindow) {
    // 重置窗口大小
    freeWindow.setSize(config.width || 800, config.height || 600)
    // 检查窗口是否允许最大化最小化（maximizable，minimizable）
    if (config.minimizable === false) {
      freeWindow.setMinimizable(false)
    }
    if (config.maximizable === false) {
      freeWindow.setMaximizable(false)
    }
    if (config.resizable === false) {
      freeWindow.setResizable(false)
    }
    // 重置当前位置
    if (config.x && config.y) {
      freeWindow.setPosition(config.x, config.y)
    }

    if (config.center) {
      freeWindow.center()
    }

    // 是否置顶窗口
    if (config.alwaysOnTop) {
      freeWindow.setAlwaysOnTop(true)
    }
    // 是否在任务栏中显示
    if (config.skipTaskbar) {
      freeWindow.setSkipTaskbar(true)
    }
    // 设置窗口标题
    if (config.title) {
      freeWindow.setTitle(config.title)
    }
  }

  /*
   * 取出一个空白窗口并且返回（仅仅取出对象）
   */
  getNewWindow () {
    // 没有使用的窗口并且不是复用的窗口
    let winInfo = this._windowList.find(row => row.isUse === false && !row.reuse)
    if (!winInfo) {
      let win = this.creatFreeWindow()
      return this.getWindowInfoById(win.id)
    }
    return winInfo
  }

  /*
   * 路由跳转
   * @parame option {object} {win: win, name: '', data: {}, router: ''}
   */
  routerPush (option) {
    // 先跳转路由，然后重新设置基础数据
    if (!option.win) return
    // 如果没有win和name直接返回
    // if (!option.win && !option.name) return
    let windowInfo
    if (option.name) {
      windowInfo = this.getWindowInfoByName(option.name)
    } else {
      windowInfo = this.getWindowInfoById(option.win.id)
    }
    if (!windowInfo) return
    let win = this.getWinById(windowInfo.id)
    this.windowRouterChange(win, option.router)
    // 设置队列信息
    windowInfo.router = option.router
    windowInfo.sendMsg = option.data
    this.setWindowInfo(windowInfo)
  }

  getWindowInfoById (id) {
    console.log(id)
    console.log(this._windowList)
    let windowInfo = this._windowList.find(row => row.id === id)
    return windowInfo
  }

  getWindowInfoByName (name) {
    return this._windowList.find(row => row.name === name)
  }

  getWinById (id) {
    return BrowserWindow.fromId(id)
  }

  getWinByName (name) {
    let windowInfo = this.getWindowInfoByName(name)
    if (!windowInfo) return
    return this.getWinById(windowInfo.id)
  }

  /*
   * 设置窗口的数据
   */
  setWindowInfo (data) {
    this._windowList = this._windowList.map(row => row.id === data.id ? data : row)
  }

  /*
   * 获取windowList对象
   */
  getWindowList () {
    return this._windowList
  }

  isPackaged () {
    const execFile = path.basename(process.execPath).toLowerCase()
    if (process.platform === 'win32') {
      return execFile !== 'electron.exe'
    }
    return execFile !== 'electron'
  }
}

module.exports = WindowsBox
