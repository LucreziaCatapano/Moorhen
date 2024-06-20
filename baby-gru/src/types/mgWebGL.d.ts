import React from 'react';

import { moorhen } from "./moorhen";

import * as vec3 from 'gl-matrix/vec3';
import * as vec4 from 'gl-matrix/vec4';
import * as quat4 from 'gl-matrix/quat';
import * as mat4 from 'gl-matrix/mat4';
import * as mat3 from 'gl-matrix/mat3';

export namespace webGL {
    interface MGWebGL extends React.Component  {
        isWebGL2() : boolean;
        lerp(a:number, b:number, f:number) : number;
        initializeSSAOBuffers() : void;
        bindSSAOBuffers() : void;
        createColourBuffer(tri: number[]) : void;
        createIndexBuffer(tri: number[]) : void;
        createSizeBuffer(tri: number[]) : void;
        addSupplementaryInfo(info: any, name: string) : void;
        calculateOriginDelta(newOrigin: [number, number, number], oldOrigin: [number, number, number], nFrames: number): [number, number, number];
        setOriginAndZoomAnimated(newOrigin: [number, number, number], newZoom: number): void;
        drawOriginAndZoomFrame(oldOrigin: [number, number, number], oldZoom: number, deltaOrigin: [number, number, number], deltaZoom: number, iframe: number): void;
        setZoomAnimated(newZoom: number): void;
        drawZoomFrame(oldZoom: number, newZoom: number, iframe: number): void;
        createInstanceSizesBuffer(tri: number[]) : void;
        createVertexBuffer(tri: number[]) : void;
        createRealNormalBuffer(tri: number[]) : void;
        createNormalBuffer(tri: number[]) : void;
        createInstanceOriginsBuffer(tri: number[]) : void;
        createInstanceOrientationsBuffer(tri: number[]) : void;
        makeCircleCanvas(text: string, width: number, height: number, circleColour: string) : void;
        makeTextCanvas(text:string, width:number, height:number, textColour:string, font?:string)  : [number,CanvasRenderingContext2D];
        calculate3DVectorFrom2DVector(inp: number[]) : vec3;
        mouseMoveAnimateTrack(force: boolean,count: number) : void;
        drawTextOverlays(invMat: number[]) : void;
        drawAxes(invMat: number[]) : void;
        drawScaleBar(invMat: number[]) : void;
        drawLineMeasures(invMat: number[]) : void;
        drawCrosshairs(invMat: number[]) : void;
        drawMouseTrack() : void;
        reContourMaps() : void;
        drawSceneDirty() : void;
        drawSceneIfDirty() : void;
        drawFPSMeter() : void;
        linesToThickLines(axesVertices: number[], axesColours: number[], size: number) : any;
        linesToThickLinesWithIndicesAndNormals(axesVertices: number[], axesNormals: number[], axesColours: number[], axesIndices: number[], size: number, doColour : boolean|null) : any;
        linesToThickLinesWithIndices(axesVertices: number[], axesColours: number[], axesIndices: number[], size: number, axesNormals_old? : number[], doColour : boolean|null) : any;
        doWheel(event: Event) : void;
        doHover(event: Event, self: any) : void;
        handleKeyUp(event: Event, self: any) : void;
        handleKeyDown(event: Event, self: any) : void;
        doMiddleClick(event: Event, self: any) : void;
        doMouseDown(event: Event, self: any) : void;
        doMouseMove(event: Event, self: any) : void;
        doDoubleClick(event: Event, self: any) : void;
        doMouseUp(event: Event, self: any) : void;
        doMouseUpMeasure(event: Event, self: any) : void;
        doMouseDownMeasure(event: Event, self: any) : void;
        doMouseMoveMeasure(event: Event, self: any) : void;
        getAtomFomMouseXY(event: Event, self: any) : number[];
        getMouseXYGL(event: Event, self: any) : any;
        canvasPointToGLPoint(point: any) : any;
        updateLabels(): void;
        doRightClick(event: Event, self: any): void;
        doClick(event: Event, self: any): void;
        drawAtomLabels(up: vec3, right: vec3, labelledAtoms: any, textColour: string, textTextureDirty: boolean) : void;
        drawDistancesAndLabels(up: vec3, right: vec3) : void;
        drawCircles(up: vec3, right: vec3) : void;
        drawTextLabels(up: vec3, right: vec3) : void;
        drawTriangles(calculatingShadowMap: boolean, invMat: mat4) : void;
        drawImagesAndText(invMat: mat4) : void;
        drawTexturedShapes(theMatrix: mat4) : void;
        drawTransparent(theMatrix: mat4) : void;
        bindFramebufferDrawBuffers() : void;
        GLrender(calculatingShadowMap: boolean) : mat4;
        drawTransformMatrixInteractivePMV(transformMatrix:number[], transformOrigin:number[], buffer:any, shader:any, vertexType:number, bufferIdx:number) : any;
        drawTransformMatrixPMV(transformMatrix:number[], buffer:any, shader:any, vertexType:number, bufferIdx:number) : any;
        setupModelViewTransformMatrixInteractive(transformMatrix:number[], transformOrigin:number[], buffer: any, shader: MGWebGLShader, vertexType: number, bufferIdx: number, specialDrawBuffer: any) : void;
        drawTransformMatrix(transformMatrix:number[], buffer:any, shader:any, vertexType:number, bufferIdx:number, specialDrawBuffer?:any) : void;
        drawBuffer(theBuffer:any,theShaderIn:MGWebGLShader|ShaderTrianglesInstanced,j:number,vertexType:number,specialDrawBuffer?:any) : void;
        drawMaxElementsUInt(vertexType:number, numItems:number) : void;
        drawTransformMatrixInteractive(transformMatrix:number[], transformOrigin:number[], buffer:any, shader:MGWebGLShader, vertexType:number, bufferIdx:number, specialDrawBuffer?:number) : void;
        applySymmetryMatrix(theShader: MGWebGLShader,symmetryMatrix: number[],tempMVMatrix: number[],tempMVInvMatrix: number[]) : void;
        setMatrixUniforms(program: MGWebGLShader) : void;
        setLightUniforms(program: MGWebGLShader) : void;
        quatDotProduct(q1: quat, q2: quat) : number;
        quatSlerp(q1: quat, q2: quat, h: number) : quat;
        centreOn(idx: number) : void;
        initTextBuffersBuffer(any) : void;
        initTextBuffers() : void;
        initInstancedOutlineShaders(vertexShaderOutline : string, fragmentShaderOutline : string)  : void;
        initInstancedShadowShaders(vertexShaderShadow : string, fragmentShaderShadow : string)  : void;
        initShadowShaders(vertexShaderShadow : string, fragmentShaderShadow : string)  : void;
        initBlurXShader(vertexShaderBlurX : string, fragmentShaderBlurX : string)  : void;
        initSSAOShader(vertexShaderBlurX : string, ssaoFragmentShader : string)  : void;
        initEdgeDetectShader(vertexShaderBlurX : string, edgeDetectFragmentShader : string)  : void;
        initBlurYShader(vertexShaderBlurY : string, fragmentShaderBlurY : string)  : void;
        initSimpleBlurXShader(vertexShaderBlurX : string, fragmentShaderBlurX : string)  : void;
        initSimpleBlurYShader(vertexShaderBlurX : string, fragmentShaderBlurX : string)  : void;
        initOverlayShader(vertexShaderOverlay : string, fragmentShaderOverlay : string)  : void;
        initRenderFrameBufferShaders(vertexShaderRenderFrameBuffer : string, fragmentShaderRenderFrameBuffer : string)  : void;
        initCirclesShaders(vertexShader : string, fragmentShader : string)  : void;
        initTextInstancedShaders(vertexShader : string, fragmentShader : string)  : void;
        initTextBackgroundShaders(vertexShaderTextBackground : string, fragmentShaderTextBackground : string)  : void;
        initOutlineShaders(vertexShader : string, fragmentShader : string)  : void;
        initShaders(vertexShader : string, fragmentShader : string)  : void;
        initShadersTextured(vertexShader : string, fragmentShader : string)  : void;
        initShadersDepthPeelAccum(vertexShader : string, fragmentShader : string)  : void;
        initGBufferShaders(vertexShader : string, fragmentShader : string)  : void;
        initGBufferShadersInstanced(vertexShader : string, fragmentShader : string)  : void;
        initGBufferShadersPerfectSphere(vertexShader : string, fragmentShader : string)  : void;
        initGBufferThickLineNormalShaders(vertexShader : string, fragmentShader : string)  : void;
        initShadersInstanced(vertexShader : string, fragmentShader : string)  : void;
        initThickLineNormalShaders(vertexShader : string, fragmentShader : string)  : void;
        initThickLineShaders(vertexShader : string, fragmentShader : string)  : void;
        initLineShaders(vertexShader : string, fragmentShader : string)  : void;
        initDepthShadowPerfectSphereShaders(vertexShader : string, fragmentShader : string)  : void;
        initPerfectSphereOutlineShaders(vertexShader : string, fragmentShader : string)  : void;
        initPerfectSphereShaders(vertexShader : string, fragmentShader : string)  : void;
        initImageShaders(vertexShader : string, fragmentShader : string)  : void;
        initTwoDShapesShaders(vertexShader : string, fragmentShader : string)  : void;
        initPointSpheresShadowShaders(vertexShader : string, fragmentShader : string)  : void;
        initPointSpheresShaders(vertexShader : string, fragmentShader : string)  : void;
        setDraggableMolecule(molecule: moorhen.Molecule): void;
        setOrigin(o: [number, number, number], doDrawScene=true, dispatchEvent=true) : void;
        buildBuffers(): void;
        drawScene() : void;
        textureBlur(width: number,height: number,inputTexture: WebGLTexture) : void;
        depthBlur(invMat) : void;
        appendOtherData(jsondata: any, skipRebuild?: boolean, name?: string) : any;
        setZoom(z: number, drawScene?: boolean);
        setOriginOrientationAndZoomAnimated(o: number[],q: quat4,z: number) : void;
        setOriginAnimated(o: number[]) : void;
        initTextureFramebuffer() : void;
        clearMeasureCylinderBuffers() : void;
        getFrontAndBackPos(event: KeyboardEvent) : [number[], number[], number, number];
        render(): any;
        draw(): void;
        startSpinTest(): void;
        stopSpinTest(): void;
        doSpinTestFrame(): void;
        componentDidUpdate(oldProps:any) : void;
        componentDidMount() : void;
        setSpinTestState(doSpin:boolean): void;
        setDiffuseLightNoUpdate(r:number, g:number, b:number) : void;
        setAmbientLightNoUpdate(r:number, g:number, b:number) : void;
        setSpecularLightNoUpdate(r:number, g:number, b:number) : void;
        setSpecularPowerNoUpdate(p:number) : void;
        setLightPositionNoUpdate(x:number, y:number, z:number) : void;
        setDiffuseLight(r:number, g:number, b:number) : void;
        setAmbientLight(r:number, g:number, b:number) : void;
        setSpecularLight(r:number, g:number, b:number) : void;
        setSpecularPower(p:number) : void;
        setLightPosition(x:number, y:number, z:number) : void;
        set_fog_range(fogStart: number, fogEnd: number, update?: boolean) : void;
        set_clip_range(clipStart: number, clipEnd: number, update?: boolean) : void;
        resize(width: number, height: number) : void;
        setShadowDepthDebug(doShadowDepthDebug: boolean): void;
        setShadowsOn(doShadow: boolean): void;
        setSSAOOn(doSSAO: boolean): void;
        setEdgeDetectOn(doEdgeDetect: boolean): void;
        setEdgeDetectDepthThreshold(depthThreshold: number): void;
        setEdgeDetectNormalThreshold(normalThreshold: number): void;
        setEdgeDetectDepthScale(depthScale: number): void;
        setEdgeDetectNormalScale(normalScale: number): void;
        setOccludeDiffuse(doOccludeDiffuse: boolean): void;
        setOutlinesOn(doOutline: boolean): void;
        setDoOrderIndependentTransparency(doOrderIndependentTransparency: boolean): void;
        setDoTransparentScreenshotBackground(transparentScreenshotBackground: boolean): void;
        setSpinTestState(doSpinTest: boolean): void;
        setBlurSize(blurSize: number): void;
        setSSAORadius(radius: number): void;
        setSSAOBias(bias: number): void;
        setTextFont(family: string,size: number) : void;
        setBackground(col: [number, number, number, number]) : void;
        setActiveMolecule(molecule: moorhen.Molecule) : void;
        setQuat(q: quat4) : void;
        setOrientationFrame(qOld: quat4, qNew: quat4, iframe: number) : void;
        setOrientationAndZoomFrame(qOld: quat4, qNew: quat4, oldZoom: number, zoomDelta: number, iframe: number) : void;
        setOrientationAndZoomAnimated(q: quat4,z: number) : void;
        setOrientationAnimated(q: quat4) : void;
        setOriginOrientationAndZoomFrame(oo: number[],d:number[],qOld:quat4, qNew:quat4, oldZoom:number, zoomDelta:number, iframe:number) : void;
        setViewAnimated(o: number[],q: quat4,z: number) : void;
        drawOriginFrame(oo: number[],d: number, iframe: number) : void;
        setWheelContour(contourFactor:number, drawScene:boolean) : void;
        setShowAxes(a: boolean) : void;
        setFog(fog: number[]);
        setSlab(slab: number[]);
        clearTextPositionBuffers(): void;
        recreateSilhouetteBuffers() : void;
        createSSAOFramebufferBuffer() : void;
        createGBuffers(width : number,height : number) : void;
        createEdgeDetectFramebufferBuffer(width : number,height : number) : void;
        recreateOffScreeenBuffers(width: number,  height: number) : void;
        recreateDepthPeelBuffers(width: number,  height: number) : void;
        createSimpleBlurOffScreeenBuffers() : void;
        draggableMolecule: moorhen.Molecule
        activeMolecule: moorhen.Molecule
        specularPower: number;
        atomLabelDepthMode: boolean;
        clipCapPerfectSpheres: boolean;
        useOffScreenBuffers: boolean;
        blurSize: number;
        blurDepth:number;
        myQuat: quat4;
        gl_fog_start: null | number;
        doDrawClickedAtomLines: boolean;
        gl_clipPlane0: null | Float32Array;
        gl_clipPlane1: null | Float32Array;
        fogClipOffset: number;
        zoom: number;
        max_elements_indices: number;
        gl_fog_end: number;
        //light_colours_specular: Float32Array;
        //light_colours_diffuse: Float32Array;
        //light_positions: Float32Array;
        //light_colours_ambient: Float32Array;
        light_colours_specular: any;
        light_colours_diffuse: any;
        light_positions: any;
        light_colours_ambient: any;
        background_colour: [number, number, number, number];
        origin: [number, number, number];
        labelledAtoms: clickAtom[][];
        measuredAtoms: clickAtom[][];
        pixel_data: Uint8Array;
        screenshotBuffersReady: boolean;
        edgeDetectFramebufferSize : number;
        gBuffersFramebufferSize : number;
        save_pixel_data: boolean;
        renderToTexture: boolean;
        transparentScreenshotBackground: boolean;
        doDepthPeelPass: boolean;
        showShortCutHelp: string[];
        WEBGL2: boolean;
        doRedraw: boolean;
        circleCanvasInitialized: boolean;
        textCanvasInitialized: boolean;
        currentlyDraggedAtom: null | {atom: moorhen.AtomInfo; buffer: DisplayBuffer};
        gl_cursorPos: Float32Array;
        textCtx: CanvasRenderingContext2D;
        circleCtx: CanvasRenderingContext2D;
        canvas: HTMLCanvasElement;
        rttFramebuffer: MGWebGLFrameBuffer;
        doPerspectiveProjection: boolean;
        labelsTextCanvasTexture: TextCanvasTexture;
        texturedShapes: TexturedShape[];
        currentBufferIdx: number;
        atom_span: number;
        axesColourBuffer: WebGLBuffer;
        axesIndexBuffer: WebGLBuffer;
        axesNormalBuffer: WebGLBuffer;
        axesPositionBuffer: WebGLBuffer;
        axesTextColourBuffer: WebGLBuffer;
        axesTextIndexesBuffer: WebGLBuffer;
        axesTextNormalBuffer: WebGLBuffer;
        axesTextPositionBuffer: WebGLBuffer;
        axesTextTexCoordBuffer: WebGLBuffer;
        backColour: string | number[];
        blurXTexture: WebGLTexture;
        blurYTexture: WebGLTexture;
        simpleBlurXTexture: WebGLTexture;
        simpleBlurYTexture: WebGLTexture;
        calculatingShadowMap: boolean;
        cancelMouseTrack: boolean;
        circleTex: WebGLTexture;
        clipChangedEvent: Event;
        context2d: CanvasRenderingContext2D;
        diskBuffer: DisplayBuffer;
        diskVertices: number[];
        doShadow: boolean;
        doSSAO: boolean;
        doEdgeDetect: boolean;
        depthThreshold: number;
        normalThreshold: number;
        scaleDepth: number;
        scaleNormal: number;
        xPixelOffset: number;
        yPixelOffset: number;
        occludeDiffuse: boolean;
        doOrderIndependentTransparency: boolean;
        doPeel: boolean;
        doShadowDepthDebug: boolean;
        doSpin: boolean;
        doStenciling: boolean;
        doneEvents: boolean;
        dx: number;
        dy: number;
        fogChangedEvent: Event;
        fpsText: string;
        framebufferDrawBuffersReady: boolean;
        framebufferDrawIndexesBuffer: WebGLBuffer;
        framebufferDrawPositionBuffer: WebGLBuffer;
        framebufferDrawTexCoordBuffer: WebGLBuffer;
        glTextFont: string;
        gl_clipPlane2: Float32Array;
        gl_clipPlane3: Float32Array;
        gl_clipPlane4: Float32Array;
        gl_clipPlane5: Float32Array;
        gl_clipPlane6: Float32Array;
        gl_clipPlane7: Float32Array;
        gl_nClipPlanes: number;
        hitchometerColourBuffer: WebGLBuffer;
        hitchometerIndexBuffer: WebGLBuffer;
        hitchometerNormalBuffer: WebGLBuffer;
        hitchometerPositionBuffer: WebGLBuffer;
        ids: string[];
        imageBuffer: DisplayBuffer;
        imageVertices: number[];
        init_x: number;
        init_y: number;
        mapLineWidth: number;
        measureCylinderBuffers: DisplayBuffer[];
        measureTextCanvasTexture: TextCanvasTexture;
        measureText2DCanvasTexture: TextCanvasTexture;
        mouseDown: boolean;
        measurePointsArray: any[];
        measureHit: any;
        measureButton: number;
        measureDownPos: any;
        mouseDown_x: number;
        mouseDown_y: number;
        mouseDownedAt: number;
        mouseMoved: boolean;
        mouseTrackColourBuffer: WebGLBuffer;
        mouseTrackIndexBuffer: WebGLBuffer;
        mouseTrackNormalBuffer: WebGLBuffer;
        mouseTrackPoints: number[][];
        mouseTrackPositionBuffer: WebGLBuffer;
        moveFactor: number;
        mspfArray: number[];
        pointsArray: number[];
        mvInvMatrix: Float32Array;
        mvMatrix: Float32Array;
        nAnimationFrames: number;
        nFrames: number;
        nPrevFrames: number;
        offScreenDepthTexture: WebGLTexture;
        ssaoFramebuffer: MGWebGLFrameBuffer;
        edgeDetectFramebuffer: MGWebGLFrameBuffer;
        gFramebuffer: MGWebGLFrameBuffer;
        gBufferRenderbufferNormal: WebGLRenderbuffer;
        gBufferRenderbufferPosition: WebGLRenderbuffer;
        gBufferPositionTexture: WebGLTexture;
        gBufferDepthTexture: WebGLTexture;
        gBufferNormalTexture: WebGLTexture;
        ssaoTexture: WebGLTexture;
        edgeDetectTexture: WebGLTexture;
        ssaoRadius: number;
        ssaoBias: number;
        offScreenFramebuffer: MGWebGLFrameBuffer;
        depthPeelFramebuffers: MGWebGLFrameBuffer[];
        depthPeelColorTextures: WebGLTexture[];
        depthPeelDepthTextures: WebGLTexture[];
        offScreenFramebufferBlurX: MGWebGLFrameBuffer;
        offScreenFramebufferBlurY: MGWebGLFrameBuffer;
        offScreenFramebufferSimpleBlurX: MGWebGLFrameBuffer;
        offScreenFramebufferSimpleBlurY: MGWebGLFrameBuffer;
        offScreenFramebufferColor: MGWebGLFrameBuffer;
        offScreenReady: boolean;
        offScreenRenderbufferColor: WebGLRenderbuffer;
        offScreenRenderbufferDepth: WebGLRenderbuffer;
        depthPeelRenderbufferColor: WebGLRenderbuffer[];
        depthPeelRenderbufferDepth: WebGLRenderbuffer[];
        offScreenTexture: WebGLTexture;
        pMatrix: Float32Array;
        pmvMatrix: Float32Array;
        prevTime: number;
        radius: number;
        reContourMapOnlyOnMouseUp: boolean;
        ready: boolean;
        renderSilhouettesToTexture: boolean;
        rttFramebufferColor: MGWebGLFrameBuffer;
        rttFramebufferDepth: MGWebGLFrameBuffer;
        rttTexture: WebGLTexture;
        rttTextureDepth: WebGLTexture;
        rttDepthTexture: WebGLTexture;
        screenZ: number;
        shaderProgramTextured: MGWebGLTextureQuadShader;
        shaderProgramDepthPeelAccum: MGWebGLShaderDepthPeelAccum;
        shaderProgram: ShaderTriangles;
        shaderProgramGBuffers: ShaderGBuffersTriangles;
        shaderProgramGBuffersInstanced: ShaderGBuffersTrianglesInstanced;
        shaderProgramGBuffersPerfectSpheres: ShaderGBuffersPerfectSpheres;
        shaderProgramGBuffersThickLinesNormal: ShaderGBuffersThickLinesNormal;
        shaderProgramSSAO: ShaderSSAO;
        shaderProgramEdgeDetect: ShaderEdgeDetect;
        shaderProgramBlurX: ShaderBlurX;
        shaderProgramBlurY: ShaderBlurY;
        shaderProgramSimpleBlurX: ShaderSimpleBlurX;
        shaderProgramSimpleBlurY: ShaderSimpleBlurY;
        shaderProgramCircles: ShaderCircles;
        shaderProgramImages: ShaderImages;
        shaderProgramInstanced: ShaderTrianglesInstanced;
        shaderProgramInstancedOutline: ShaderTrianglesInstanced;
        shaderProgramInstancedShadow: ShaderTrianglesInstanced;
        shaderProgramLines: MGWebGLShader;
        shaderProgramOutline: ShaderOutLine;
        shaderProgramOverlay: ShaderOverlay;
        shaderProgramPerfectSpheres: ShaderPerfectSpheres;
        shaderProgramPerfectSpheresOutline: ShaderPerfectSpheres;
        shaderProgramPointSpheres: ShaderPointSpheres;
        shaderProgramPointSpheresShadow: ShaderPointSpheres;
        shaderProgramRenderFrameBuffer: ShaderFrameBuffer;
        shaderProgramShadow: MGWebGLShader;
        shaderProgramTextBackground: ShaderTextBackground;
        shaderProgramTextInstanced: ShaderTextInstanced;
        shaderProgramThickLines: ShaderThickLines;
        shaderProgramThickLinesNormal: ShaderThickLinesNormal;
        shaderProgramTwoDShapes: ShaderTwodShapes;
        shaderDepthShadowProgramPerfectSpheres: ShaderPerfectSpheres;
        shinyBack: boolean;
        showAxes: boolean;
        showScaleBar: boolean;
        showCrosshairs: boolean;
        showFPS: boolean;
        silhouetteBufferReady: boolean;
        silhouetteDepthTexture: WebGLTexture;
        silhouetteFramebuffer: MGWebGLFrameBuffer;
        silhouetteRenderbufferColor: WebGLRenderbuffer;
        silhouetteRenderbufferDepth: WebGLRenderbuffer;
        silhouetteTexture: WebGLTexture;
        sphereBuffer: DisplayBuffer;
        state:  {width: number, height: number };
        statusChangedEvent: Event;
        stencilPass: boolean;
        stenciling: boolean;
        textHeightScaling: number;
        textTex: WebGLTexture;
        ssaoNoiseTexture: WebGLTexture;
        blurUBOBuffer: WebGLBuffer;
        ssaoKernelBuffer: WebGLBuffer;
        ssaoKernel: number[];
        trackMouse: boolean;
        viewChangedEvent: Event;
        props: MGWebGLPropsInterface;
        extraFontCtxs: Dictionary<HTMLCanvasElement>;
        mouseDownButton: number;
        keysDown: Dictionary<number>;

        textLegends: any;
        textureMatrix: mat4;
        displayBuffers: any[];
        gl:  any;
        canvasRef: any;
        depth_texture: any;
        frag_depth_ext: any;
        drawBuffersExt: any;
        instanced_ext: any;
        ext: any;
        newTextLabels: any;
        drawingGBuffers: boolean;
        initializeShaders() : void;
        axesTexture: any;

        hoverSize: number;

    }
}
