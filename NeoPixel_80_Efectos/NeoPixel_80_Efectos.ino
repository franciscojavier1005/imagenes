/*
 =============================================================
  NEOPIXEL 80 EFECTOS AVANZADOS PARA ARDUINO UNO
  Anillo NeoPixel 12 LEDs RGB - PIN 7 (Digital)
 =============================================================
  BIBLIOTECA REQUERIDA: Adafruit NeoPixel
  Instalar desde: Sketch > Incluir librería > Gestionar librerías
                  Buscar "Adafruit NeoPixel" e instalar.

  CONEXIÓN HARDWARE:
    NeoPixel DIN  --> Arduino PIN 7
    NeoPixel +5V  --> Arduino +5V (con capacitor 1000uF entre +5V y GND)
    NeoPixel GND  --> Arduino GND
    Resistencia 300-500 Ohm en serie en el PIN 7 (recomendado)

  ANILLOS / TIRAS ADICIONALES:
    Descomentar las líneas ring2 / strip1 en setup() y loop()
    Ajustar NUM_LEDS_RING2 y NUM_LEDS_STRIP1 según el hardware.

  GRUPOS DE 8 EFECTOS (10 grupos = 80 efectos):
    Grupo  1 - Efectos Cosmicos  / Espaciales
    Grupo  2 - Efectos de Fuego  / Energia
    Grupo  3 - Efectos de Agua   / Ocean
    Grupo  4 - Explosiones       / Bursts
    Grupo  5 - Espirales         / Rotaciones
    Grupo  6 - Desvanecimientos  / Respiracion
    Grupo  7 - Arcoiris          / Prismaticos
    Grupo  8 - Pulsos            / Latidos
    Grupo  9 - Matrix            / Digital
    Grupo 10 - Aurora            / Boreal
 =============================================================
*/

#include <Adafruit_NeoPixel.h>

// ============================================================
// CONFIGURACION PRINCIPAL
// ============================================================
#define PIN_RING1       7     // Pin anillo principal (12 LEDs)
#define PIN_RING2       6     // Pin segundo anillo (opcional)
#define PIN_STRIP1      5     // Pin tira adicional  (opcional)

#define NUM_LEDS_RING1  12
#define NUM_LEDS_RING2  12    // Ajustar segun hardware
#define NUM_LEDS_STRIP1 30    // Ajustar segun hardware

#define BRIGHTNESS      80    // Brillo global 0-255

// Instancia principal (obligatoria)
Adafruit_NeoPixel ring1(NUM_LEDS_RING1, PIN_RING1, NEO_GRB + NEO_KHZ800);

// Instancias opcionales - descomentar para activar:
// Adafruit_NeoPixel ring2(NUM_LEDS_RING2,  PIN_RING2,  NEO_GRB + NEO_KHZ800);
// Adafruit_NeoPixel strip1(NUM_LEDS_STRIP1, PIN_STRIP1, NEO_GRB + NEO_KHZ800);

// Alias de trabajo sobre el anillo principal
#define strip   ring1
#define N       NUM_LEDS_RING1

// ============================================================
// VARIABLES GLOBALES DE SECUENCIA
// ============================================================
uint8_t  effectGroup = 0;
uint8_t  effectIdx   = 0;
uint32_t lastChange  = 0;

// Duraciones individuales por [grupo][efecto] en ms
const uint16_t effectDurations[10][8] PROGMEM = {
  {5000,4000,3500,6000,5000,4500,5000,4000},  // G1 Cosmico
  {6000,4500,3000,5000,4500,4000,5000,4000},  // G2 Fuego
  {5000,5000,4500,5000,5000,4500,5000,4500},  // G3 Agua
  {4500,5000,4000,5000,4000,4500,4000,4500},  // G4 Explosion
  {5000,5000,5000,4500,5000,5000,5000,5000},  // G5 Espiral
  {5500,5000,5000,5500,5000,5000,5000,5000},  // G6 Fade
  {5000,5000,5000,5000,5000,5000,5000,5000},  // G7 Arcoiris
  {5000,5000,5000,5000,5000,5000,5000,5000},  // G8 Pulsos
  {5000,5000,4000,5000,5000,5000,5000,5000},  // G9 Digital
  {5000,5000,5000,5000,5000,5000,5000,5000},  // G10 Aurora
};

// ============================================================
// UTILIDADES
// ============================================================

// Color HSV con gamma correction
uint32_t chsv(uint16_t h, uint8_t s, uint8_t v) {
  return strip.gamma32(strip.ColorHSV(h, s, v));
}

// Mezcla dos colores segun factor 0-255
uint32_t blendColor(uint32_t c1, uint32_t c2, uint8_t t) {
  uint8_t r = ((uint8_t)(c1>>16)*(255-t) + (uint8_t)(c2>>16)*t) / 255;
  uint8_t g = ((uint8_t)(c1>>8) *(255-t) + (uint8_t)(c2>>8) *t) / 255;
  uint8_t b = ((uint8_t)(c1)    *(255-t) + (uint8_t)(c2)    *t) / 255;
  return strip.Color(r, g, b);
}

// Atenua un color por factor 0-255
uint32_t dimC(uint32_t c, uint8_t f) {
  return strip.Color(
    (uint8_t)(c>>16)*f/255,
    (uint8_t)(c>>8) *f/255,
    (uint8_t)(c)    *f/255
  );
}

void clearAll()           { strip.clear(); strip.show(); }
void fillAll(uint32_t c)  { for(int i=0;i<N;i++) strip.setPixelColor(i,c); strip.show(); }

// ============================================================
// TRANSICIONES ENTRE GRUPOS
// ============================================================

void transWipe(uint32_t color) {
  for(int i=0;i<N;i++){ strip.setPixelColor(i,0); strip.show(); delay(35); }
  delay(180);
  for(int i=0;i<N;i++){ strip.setPixelColor(i,color); strip.show(); delay(35); }
  delay(180); clearAll();
}

void transFade(uint16_t ms) {
  int steps = 40;
  for(int s=steps;s>=0;s--){
    strip.setBrightness(BRIGHTNESS*s/steps);
    strip.show(); delay(ms/steps);
  }
  clearAll();
  strip.setBrightness(BRIGHTNESS);
}

void transSpiral(uint32_t color) {
  for(int i=0;i<N;i++){ strip.setPixelColor((i+6)%N,color); strip.show(); delay(45); }
  delay(250);
  for(int i=N-1;i>=0;i--){ strip.setPixelColor((i+6)%N,0); strip.show(); delay(45); }
  delay(180);
}

void transFlash(uint32_t color, int times) {
  for(int t=0;t<times;t++){ fillAll(color); delay(75); clearAll(); delay(75); }
}

void transExplosion(uint32_t color) {
  for(int r=0;r<6;r++){
    strip.clear();
    strip.setPixelColor(r,color); strip.setPixelColor(N-1-r,color);
    strip.show(); delay(55);
  }
  for(int r=5;r>=0;r--){
    strip.clear();
    for(int i=r;i<N-r;i++) strip.setPixelColor(i,color);
    strip.show(); delay(45);
  }
  delay(180); transFade(600);
}

// ============================================================
// GRUPO 1 - COSMICO / ESPACIAL
// ============================================================

// 1.1 Nebulosa Pulsante
void eff_Nebula() {
  static uint16_t hue=0;
  static float    phase=0;
  unsigned long t=millis();
  for(int i=0;i<N;i++){
    float a=(float)i/N*6.2832f + t*0.001f;
    float b=(sinf(a+phase*0.3f)+1.0f)*0.5f;
    strip.setPixelColor(i, chsv(hue+(i*65536L/N), 200, b*195+10));
  }
  hue+=150; phase+=0.04f; strip.show(); delay(18);
}

// 1.2 Agujero Negro (implosion orbital)
void eff_BlackHole() {
  for(int rep=0;rep<3;rep++){
    for(int step=0;step<N/2;step++){
      strip.clear();
      for(int i=0;i<=step;i++){
        uint8_t b=map(i,0,step+1,30,240);
        uint16_t h=43000+i*2200;
        strip.setPixelColor((step-i)%N, chsv(h,220,b));
        strip.setPixelColor((step-i+6)%N, chsv(h,220,b));
      }
      strip.show(); delay(75);
    }
    delay(220);
  }
}

// 1.3 Supernova
void eff_Supernova() {
  uint32_t c=strip.Color(255,200,50);
  for(int b=0;b<255;b+=5){
    for(int i=0;i<N;i++){
      float d=fabsf(i-5.5f);
      strip.setPixelColor(i,dimC(c,max(0,255-(int)(d*28)-(255-b))));
    }
    strip.show(); delay(12);
  }
  for(int b=255;b>=0;b-=5){
    fillAll(dimC(strip.Color(255,160,0),b)); delay(6);
  }
  clearAll();
}

// 1.4 Estrellas Parpadeantes
void eff_StarTwinkle() {
  static uint8_t  sb[12]={0};
  static int8_t   sd[12]={0};
  static uint16_t sh[12]={0};
  for(int i=0;i<N;i++){
    if(sd[i]==0 && random(18)==0){ sd[i]=1; sh[i]=random(65536); }
    if(sd[i]==1){ sb[i]+=18; if(sb[i]>=238) sd[i]=-1; }
    else if(sd[i]==-1){ if(sb[i]>12) sb[i]-=12; else{ sb[i]=0; sd[i]=0; } }
    strip.setPixelColor(i, chsv(sh[i], 60, sb[i]));
  }
  strip.show(); delay(28);
}

// 1.5 Via Lactea
void eff_MilkyWay() {
  static float off=0;
  for(int i=0;i<N;i++){
    float v=(sinf((i+off)*0.8f)+1.0f)*0.5f;
    strip.setPixelColor(i, strip.Color(v*170,v*140,v*255));
  }
  off+=0.15f; strip.show(); delay(35);
}

// 1.6 Pulsar (estrella de neutrones)
void eff_Pulsar() {
  for(int rep=0;rep<8;rep++){
    for(int b=0;b<=255;b+=22){
      strip.clear();
      strip.setPixelColor(0, chsv(40000+rep*3000,255,b));
      strip.setPixelColor(6, chsv(40000+rep*3000,255,b));
      strip.show(); delay(5);
    }
    for(int b=255;b>=0;b-=14){
      strip.clear();
      for(int r=0;r<N;r++){
        float fade=max(0.0f,(float)b-fabsf(r-6)*28.0f);
        strip.setPixelColor(r, chsv(40000+rep*3000,255,(uint8_t)fade));
      }
      strip.show(); delay(8);
    }
    delay(max(0,280-rep*32));
  }
}

// 1.7 Galaxia en Rotacion
void eff_Galaxy() {
  static float    angle=0;
  static uint16_t baseHue=0;
  for(int i=0;i<N;i++){
    float pos=(float)i/N*6.2832f+angle;
    float sp=sinf(pos*2)*cosf(pos);
    strip.setPixelColor(i, chsv(baseHue+(i*65536L/N), 200, (uint8_t)((sp+1.0f)*100+30)));
  }
  angle+=0.08f; baseHue+=100; strip.show(); delay(22);
}

// 1.8 Agujero de Gusano
void eff_Wormhole() {
  for(int frame=0;frame<60;frame++){
    for(int i=0;i<N;i++){
      float t=(float)frame/60.0f;
      float pos=fmodf((float)i/N+t,1.0f);
      uint8_t b=(uint8_t)(powf(sinf(pos*3.1416f),3)*240+5);
      uint16_t h=(uint16_t)(pos*65535)+43000;
      strip.setPixelColor(i, chsv(h,220,b));
    }
    strip.show(); delay(28);
  }
}

// ============================================================
// GRUPO 2 - FUEGO / ENERGIA
// ============================================================

// 2.1 Llama Real (fire simulation)
void eff_Fire() {
  static uint8_t heat[12]={0};
  for(int i=0;i<N;i++) heat[i]=(uint8_t)max(0,(int)heat[i]-random(10,24));
  for(int i=N-1;i>=2;i--) heat[i]=(heat[i-1]+heat[i-2]+heat[i-2])/3;
  if(random(3)==0){ int y=random(4); heat[y]=(uint8_t)min(255,(int)heat[y]+random(160,255)); }
  for(int i=0;i<N;i++){
    uint8_t t2=heat[i], r,g,b;
    if(t2<85)     { r=t2*3;    g=0;        b=0; }
    else if(t2<170){ r=255;     g=(t2-85)*3; b=0; }
    else           { r=255;     g=255;       b=(t2-170)*3; }
    strip.setPixelColor(i, strip.Color(r,g,b));
  }
  strip.show(); delay(48);
}

// 2.2 Plasma Electrico
void eff_Plasma() {
  static uint16_t t=0;
  for(int i=0;i<N;i++){
    float v1=sinf(i*0.5f+t*0.022f);
    float v2=sinf((i+t*0.03f)*0.7f);
    float pl=(v1+v2)*0.5f;
    strip.setPixelColor(i, chsv((uint16_t)((pl+1.0f)*16000)+43000, 255, (uint8_t)((pl+1.0f)*115+20)));
  }
  t++; strip.show(); delay(18);
}

// 2.3 Descarga Electrica (lightning)
void eff_Lightning() {
  clearAll(); delay(random(200,700));
  for(int f=0;f<random(3,8);f++){
    int st=random(N), ln=random(2,6);
    for(int i=0;i<ln;i++) strip.setPixelColor((st+i)%N, strip.Color(200,200,255));
    strip.show(); delay(random(20,75));
    clearAll(); delay(random(30,140));
  }
}

// 2.4 Lava Lampara
void eff_LavaLamp() {
  static float blobs[3]={0,4,8};
  static float spds[3]={0.05f,0.08f,0.06f};
  static uint32_t bc[3]={0xFF0000,0xFF6600,0xFF2200};
  strip.clear();
  for(int i=0;i<N;i++){
    float r=0,g=0,b=0,tot=0;
    for(int bl=0;bl<3;bl++){
      float d=fabsf(i-blobs[bl]);
      if(d>N/2) d=N-d;
      float inten=max(0.0f,1.0f-d/3.0f);
      inten*=inten;
      r+=inten*((bc[bl]>>16)&0xFF);
      g+=inten*((bc[bl]>>8)&0xFF);
      b+=inten*(bc[bl]&0xFF);
      tot+=inten;
    }
    if(tot>0) strip.setPixelColor(i, strip.Color(
      (uint8_t)min(255,(int)(r/tot*1.5f)),
      (uint8_t)min(255,(int)(g/tot*1.5f)),
      (uint8_t)min(255,(int)(b/tot*1.5f))));
  }
  for(int bl=0;bl<3;bl++){
    blobs[bl]+=spds[bl];
    if(blobs[bl]>=N) blobs[bl]-=N;
  }
  strip.show(); delay(28);
}

// 2.5 Corazon Ardiente
void eff_BurningHeart() {
  static uint8_t beat=0;
  static int8_t  beatDir=1;
  beat+=beatDir*8;
  if(beat>=240) beatDir=-1;
  if(beat<=10)  beatDir=1;
  for(int i=0;i<N;i++){
    float d=fabsf(i-5.5f);
    float fade=max(0.0f,1.0f-d/5.5f);
    strip.setPixelColor(i, strip.Color((uint8_t)(fade*beat),0,0));
  }
  if(random(5)==0) strip.setPixelColor(random(N), strip.Color(255,140,0));
  strip.show(); delay(18);
}

// 2.6 Sobrecarga de Energia
void eff_EnergyOverload() {
  uint32_t cols[5]={0xFF0000,0xFF4400,0xFF8800,0xFFCC00,0xFFFFFF};
  for(int w=0;w<5;w++){
    for(int i=0;i<N;i++){ strip.setPixelColor(i,cols[w]); strip.show(); delay(14); }
    for(int b=255;b>=0;b-=22){ fillAll(dimC(cols[w],b)); delay(10); }
  }
}

// 2.7 Sol Giratorio
void eff_RotatingSun() {
  static uint16_t ang=0;
  int c1=(ang/550)%N, c2=(c1+6)%N;
  for(int i=0;i<N;i++){
    float d1=fabsf((float)i-c1); if(d1>N/2) d1=N-d1;
    float d2=fabsf((float)i-c2); if(d2>N/2) d2=N-d2;
    float d=min(d1,d2);
    uint8_t b=(uint8_t)max(0,255-(int)(d*75));
    strip.setPixelColor(i, strip.Color(b,(uint8_t)(b*0.6f),0));
  }
  ang++; strip.show(); delay(18);
}

// 2.8 Tormenta de Fotones
void eff_PhotonStorm() {
  static uint8_t pho[12]={0};
  for(int i=0;i<N;i++){
    if(pho[i]>15) pho[i]-=15; else pho[i]=0;
    if(random(9)==0) pho[i]=255;
    strip.setPixelColor(i, strip.Color(pho[i],(uint8_t)(pho[i]*0.65f),0));
  }
  strip.show(); delay(28);
}

// ============================================================
// GRUPO 3 - AGUA / OCEANO
// ============================================================

// 3.1 Olas del Oceano
void eff_OceanWaves() {
  static float phase=0;
  for(int i=0;i<N;i++){
    float w1=(sinf(i*0.6f+phase)+1.0f)*0.5f;
    float w2=(sinf(i*1.2f-phase*0.7f)+1.0f)*0.5f;
    float v=(w1+w2)*0.5f;
    strip.setPixelColor(i, strip.Color((uint8_t)(v*18),(uint8_t)(v*75),(uint8_t)(v*225)));
  }
  phase+=0.11f; strip.show(); delay(22);
}

// 3.2 Bioluminiscencia
void eff_Bioluminescence() {
  static uint8_t  br[12]={0};
  static uint8_t  tm[12]={0};
  for(int i=0;i<N;i++){
    if(tm[i]==0 && random(18)==0){ br[i]=255; tm[i]=1; }
    if(tm[i]>0){ if(br[i]>5) br[i]-=5; else{ br[i]=0; tm[i]=0; } }
    strip.setPixelColor(i, strip.Color(0,(uint8_t)(br[i]*0.8f),br[i]));
  }
  strip.show(); delay(38);
}

// 3.3 Espejo de Agua
void eff_WaterMirror() {
  static uint16_t t=0;
  for(int i=0;i<N/2;i++){
    float r=sinf(i*0.8f+t*0.05f)*cosf(i*0.4f+t*0.03f);
    uint8_t b=(uint8_t)((r+1.0f)*100+28);
    uint32_t c=strip.Color(0,(uint8_t)(b*0.4f),b);
    strip.setPixelColor(i,c);
    strip.setPixelColor(N-1-i,c);
  }
  t++; strip.show(); delay(28);
}

// 3.4 Hielo Fractal
void eff_IceFractal() {
  static float t=0;
  for(int i=0;i<N;i++){
    float x=(float)i/N*6.2832f;
    float v=sinf(x+t)*sinf(x*2-t*0.7f)*cosf(t*0.3f);
    uint8_t b=(uint8_t)((v+1.0f)*115+20);
    strip.setPixelColor(i, strip.Color((uint8_t)(b*0.65f),(uint8_t)(b*0.88f),b));
  }
  t+=0.05f; strip.show(); delay(28);
}

// 3.5 Lluvia de Gotas
void eff_RainDrop() {
  static uint8_t dr[12]={0};
  for(int i=0;i<N;i++){
    if(dr[i]>0){ strip.setPixelColor(i, strip.Color(0,(uint8_t)(dr[i]*0.28f),dr[i])); dr[i]-=12; }
    else{
      if(random(14)==0) dr[i]=255;
      strip.setPixelColor(i, strip.Color(0,5,14));
    }
  }
  strip.show(); delay(38);
}

// 3.6 Tsunami
void eff_Tsunami() {
  for(int wave=0;wave<4;wave++){
    for(int i=0;i<N+4;i++){
      strip.clear();
      for(int j=0;j<5;j++){
        int pos=(i-j+N)%N;
        uint8_t b=(uint8_t)map(j,0,5,245,28);
        if(i-j>=0) strip.setPixelColor(pos, strip.Color(0,(uint8_t)(b*0.18f),b));
      }
      strip.show(); delay(48);
    }
    delay(190);
  }
}

// 3.7 Coral Fosforescente
void eff_CoralGlow() {
  static uint16_t t=0;
  for(int i=0;i<N;i++){
    float v=sinf(i*0.9f+t*0.04f)*sinf(i*1.7f-t*0.06f);
    strip.setPixelColor(i, chsv(26000+i*1100+t*55, 200, (uint8_t)((v+1.0f)*95+50)));
  }
  t++; strip.show(); delay(28);
}

// 3.8 Cristal de Hielo
void eff_IceCrystal() {
  for(int frame=0;frame<42;frame++){
    for(int i=0;i<N;i++){
      float a=(float)i/N*6.2832f;
      float t=(float)frame/42.0f;
      float v=cosf(a*3+t*6.2832f)*sinf(a*2-t*6.2832f);
      uint8_t b=(uint8_t)((v+1.0f)*112+18);
      strip.setPixelColor(i, strip.Color((uint8_t)(b*0.58f),(uint8_t)(b*0.88f),b));
    }
    strip.show(); delay(38);
  }
}

// ============================================================
// GRUPO 4 - EXPLOSIONES / BURSTS
// ============================================================

// 4.1 Big Bang
void eff_BigBang() {
  for(int r=N/2;r>=0;r--){
    strip.clear();
    for(int i=0;i<N;i++){
      float d=fabsf((float)i-5.5f);
      if(d<=r){ uint8_t b=(uint8_t)map((int)d,0,r+1,250,45); strip.setPixelColor(i,strip.Color(b,(uint8_t)(b*0.65f),0)); }
    }
    strip.show(); delay(55);
  }
  for(int r=0;r<=N/2;r++){
    strip.clear();
    for(int i=0;i<N;i++){
      float d=fabsf((float)i-5.5f);
      if(d<=r && d>=r-2){ uint8_t b=(uint8_t)map(r,0,N/2,250,45); strip.setPixelColor(i,strip.Color(b,(uint8_t)(b*0.48f),0)); }
    }
    strip.show(); delay(38);
  }
  transFade(750);
}

// 4.2 Fuegos Artificiales
void eff_Fireworks() {
  int center=random(N);
  uint32_t cols[8]={0xFF0000,0xFF8800,0xFFFF00,0x00FF00,0x00FFFF,0x0080FF,0xFF00FF,0xFFFFFF};
  uint32_t color=cols[random(8)];
  for(int i=0;i<center;i++){ strip.clear(); strip.setPixelColor(i,strip.Color(255,255,200)); strip.show(); delay(28); }
  for(int sp=0;sp<6;sp++){
    strip.clear();
    for(int i=max(0,center-sp);i<=min(N-1,center+sp);i++) strip.setPixelColor(i,dimC(color,255-sp*38));
    strip.show(); delay(55);
  }
  for(int s=0;s<22;s++){ int p=random(N); strip.setPixelColor(p,dimC(color,random(90,255))); strip.show(); delay(28); strip.setPixelColor(p,0); }
}

// 4.3 Detonacion Nuclear
void eff_NuclearBlast() {
  fillAll(strip.Color(255,255,255)); delay(90);
  for(int r=0;r<N;r++){
    strip.clear();
    for(int i=0;i<N;i++){
      int d=abs(i-N/2);
      if(d==r||d==N-r){ strip.setPixelColor(i,strip.Color(255,max(0,195-r*15),0)); }
      else if(d<r)      { strip.setPixelColor(i,strip.Color(10,5,0)); }
    }
    strip.show(); delay(48);
  }
  transFade(950);
}

// 4.4 Confeti Explosivo
void eff_Confetti() {
  static uint8_t  fade[12]={0};
  static uint16_t hues[12]={0};
  for(int i=0;i<N;i++){
    if(fade[i]>14) fade[i]-=14; else fade[i]=0;
    if(random(9)==0){ fade[i]=255; hues[i]=random(65536); }
    strip.setPixelColor(i, chsv(hues[i],255,fade[i]));
  }
  strip.show(); delay(22);
}

// 4.5 Colapso Cuantico
void eff_QuantumCollapse() {
  for(int frame=0;frame<28;frame++){
    for(int i=0;i<N;i++) strip.setPixelColor(i, chsv(random(65536),255,random(100,255)));
    strip.show(); delay(28);
  }
  for(int r=N/2;r>=0;r--){
    strip.clear();
    for(int i=N/2-r;i<=N/2+r;i++){
      if(i>=0&&i<N) strip.setPixelColor(i, chsv(random(65536),255,255));
    }
    strip.show(); delay(48);
  }
  clearAll();
}

// 4.6 Fragmentacion
void eff_Fragmentation() {
  uint32_t cols[12];
  for(int i=0;i<N;i++) cols[i]=chsv(i*5461,255,200);
  for(int i=0;i<N;i++) strip.setPixelColor(i,cols[i]); strip.show(); delay(480);
  for(int s=0;s<22;s++){
    for(int i=0;i<N;i++) if(random(4)==0) strip.setPixelColor(i,0);
    strip.show(); delay(95);
  }
  clearAll();
}

// 4.7 Pulso de Impacto
void eff_ImpactPulse() {
  for(int pulse=0;pulse<5;pulse++){
    uint8_t mx=255-pulse*40;
    for(int b=0;b<=mx;b+=18){ fillAll(strip.Color(b,(uint8_t)(b*0.65f),0)); delay(9); }
    for(int b=mx;b>=0;b-=14){ fillAll(strip.Color(b,(uint8_t)(b*0.65f),0)); delay(13); }
    delay(95+pulse*48);
  }
  clearAll();
}

// 4.8 Anillo Expansivo de Fuego
void eff_ExpansionRing() {
  uint32_t cols[4]={0xFF0000,0xFF4400,0xFF8800,0xFFCC00};
  for(int pass=0;pass<4;pass++){
    for(int r=0;r<N;r++){
      strip.clear();
      strip.setPixelColor(r%N,cols[pass]);
      strip.setPixelColor((r+1)%N,dimC(cols[pass],175));
      strip.setPixelColor((r+2)%N,dimC(cols[pass],75));
      strip.show(); delay(38);
    }
    delay(140);
  }
}

// ============================================================
// GRUPO 5 - ESPIRALES / ROTACIONES
// ============================================================

// 5.1 Espiral Hipnotica
void eff_HypnoticSpiral() {
  static uint16_t hue=0;
  static float    phase=0;
  for(int i=0;i<N;i++){
    float a=(float)i/N*6.2832f;
    float v=sinf(a*3+phase);
    strip.setPixelColor(i, chsv(hue+(i*65536L/N), 255, (uint8_t)((v+1.0f)*112+18)));
  }
  hue+=200; phase+=0.14f; strip.show(); delay(18);
}

// 5.2 Espiral Doble
void eff_DoubleSpiral() {
  static uint16_t pos=0;
  strip.clear();
  for(int arm=0;arm<2;arm++){
    for(int len=0;len<4;len++){
      int idx=(pos+arm*(N/2)+len)%N;
      uint8_t b=(uint8_t)map(len,0,4,250,38);
      uint16_t h=43000+arm*32768+pos*200;
      strip.setPixelColor(idx, chsv(h,220,b));
    }
  }
  pos=(pos+1)%N; strip.show(); delay(55);
}

// 5.3 Vortice de Colores
void eff_ColorVortex() {
  static uint16_t t=0;
  for(int i=0;i<N;i++){
    uint16_t h=(uint16_t)((long)i*65536/N + (long)t*150)%65536;
    float bv=sinf((float)i/N*6.2832f*2+t*0.1f);
    strip.setPixelColor(i, chsv(h,255,(uint8_t)((bv+1.0f)*95+55)));
  }
  t++; strip.show(); delay(18);
}

// 5.4 Helice Cromatica
void eff_ChromaticHelix() {
  for(int frame=0;frame<72;frame++){
    for(int i=0;i<N;i++){
      float t=(float)frame/72.0f;
      float pos=(float)i/N;
      float v=sinf((pos+t)*6.2832f*2)*cosf((pos-t*0.5f)*6.2832f);
      strip.setPixelColor(i, chsv((uint16_t)(pos*65535+frame*800), 255, (uint8_t)((v+1.0f)*105+38)));
    }
    strip.show(); delay(28);
  }
}

// 5.5 Pendulo de Newton (luz)
void eff_NewtonPendulum() {
  static float angle=0, vel=0.05f;
  float pos=(sinf(angle)+1.0f)*(N-1)*0.5f;
  int ip=(int)pos;
  float fr=pos-ip;
  strip.clear();
  strip.setPixelColor(ip,   strip.Color((uint8_t)(255*(1-fr)),(uint8_t)(95*(1-fr)),0));
  if(ip+1<N) strip.setPixelColor(ip+1, strip.Color((uint8_t)(255*fr),(uint8_t)(95*fr),0));
  for(int t=1;t<4;t++){
    int prev=ip-t;
    if(prev>=0) strip.setPixelColor(prev, strip.Color(55/t,18/t,0));
  }
  angle+=vel; strip.show(); delay(18);
}

// 5.6 Remolino Tricomatico
void eff_TricolorWhirl() {
  static uint16_t off=0;
  uint32_t cols[3]={0xFF0000,0x00FF00,0x0000FF};
  for(int i=0;i<N;i++){
    int seg=((i+off)*3/N)%3;
    int pis=(i+off)%(N/3);
    strip.setPixelColor(i, dimC(cols[seg],(uint8_t)map(pis,0,N/3,250,48)));
  }
  off++; strip.show(); delay(38);
}

// 5.7 Espiral de Fibonacci
void eff_FibonacciSpiral() {
  static float t=0;
  for(int i=0;i<N;i++){
    float angle=i*2.39996f;
    float r=sqrtf((float)i)/sqrtf((float)N);
    float v=sinf(r*6.2832f*2+t);
    uint16_t h=(uint16_t)(angle/6.2832f*65535+t*500);
    strip.setPixelColor(i, chsv(h,255,(uint8_t)((v+1.0f)*112+18)));
  }
  t+=0.08f; strip.show(); delay(28);
}

// 5.8 Torbellino Bicolor
void eff_BicolorTornado() {
  static uint16_t pos=0;
  uint32_t c1=chsv(pos*100,255,195);
  uint32_t c2=chsv(pos*100+32768,255,195);
  for(int i=0;i<N;i++){
    float mix=(sinf((float)i/N*6.2832f*3+(float)pos*0.1f)+1.0f)*0.5f;
    strip.setPixelColor(i, blendColor(c1,c2,(uint8_t)(mix*255)));
  }
  pos++; strip.show(); delay(22);
}

// ============================================================
// GRUPO 6 - DESVANECIMIENTOS / RESPIRACION
// ============================================================

// 6.1 Respiracion Arcoiris
void eff_RainbowBreath() {
  static uint16_t hue=0;
  static float    breath=0;
  float b=(sinf(breath)+1.0f)*0.5f;
  for(int i=0;i<N;i++) strip.setPixelColor(i, chsv(hue+(i*65536L/N), 255, (uint8_t)(b*215+10)));
  breath+=0.03f; hue+=48; strip.show(); delay(18);
}

// 6.2 Transicion Cromatica Suave
void eff_SmoothChromatic() {
  static uint16_t h1=0, h2=32768;
  for(int i=0;i<N;i++){
    float t=(float)i/(N-1);
    strip.setPixelColor(i, chsv((uint16_t)(h1+t*(h2-h1)), 220, 200));
  }
  h1+=95; h2+=95; strip.show(); delay(28);
}

// 6.3 Degradado Ondulante
void eff_WaveGradient() {
  static float t=0;
  for(int i=0;i<N;i++){
    float pos=(float)i/N;
    float wave=sinf(pos*6.2832f+t);
    uint16_t h=(uint16_t)((pos+wave*0.3f)*65535+t*490);
    strip.setPixelColor(i, chsv(h,200,(uint8_t)((wave+1.0f)*95+78)));
  }
  t+=0.04f; strip.show(); delay(22);
}

// 6.4 Aurora Suave
void eff_SoftAurora() {
  static uint16_t t=0;
  for(int i=0;i<N;i++){
    float v1=sinf((float)i/N*3+t*0.022f);
    float v2=cosf((float)i/N*2-t*0.015f);
    float v=(v1+v2)*0.5f;
    strip.setPixelColor(i, chsv(21845+(uint16_t)(v*9800), 200, (uint8_t)((v+1.0f)*95+62)));
  }
  t++; strip.show(); delay(28);
}

// 6.5 Respiracion Latente (dos mitades)
void eff_LatentBreath() {
  static float phase=0;
  float b1=(sinf(phase)+1.0f)*0.5f;
  float b2=(sinf(phase*0.5f+3.1416f)+1.0f)*0.5f;
  for(int i=0;i<N/2;i++){
    strip.setPixelColor(i,       strip.Color((uint8_t)(b1*175),18,(uint8_t)(b2*195)));
    strip.setPixelColor(N-1-i,   strip.Color((uint8_t)(b2*175),18,(uint8_t)(b1*195)));
  }
  phase+=0.04f; strip.show(); delay(18);
}

// 6.6 Pulso Cuantico (targets aleatorios)
void eff_QuantumPulse() {
  static uint8_t  cur[12]={0}, tgt[12]={0};
  static uint8_t  state=0;
  if(state==0){ for(int i=0;i<N;i++) tgt[i]=random(28,252); state=1; }
  bool done=true;
  for(int i=0;i<N;i++){
    if(cur[i]<tgt[i]){ cur[i]=(uint8_t)min((int)tgt[i],(int)cur[i]+8); done=false; }
    else if(cur[i]>tgt[i]){ cur[i]=(uint8_t)max((int)tgt[i],(int)cur[i]-8); done=false; }
    strip.setPixelColor(i, chsv(i*5461+20000, 200, cur[i]));
  }
  if(done) state=0;
  strip.show(); delay(22);
}

// 6.7 Ola de Desvanecimiento
void eff_FadeWave() {
  static uint16_t off=0;
  for(int i=0;i<N;i++){
    float pos=(float)((i+off)%N)/N;
    strip.setPixelColor(i, chsv((uint16_t)((i*65536L/N)+off*490)%65536, 220,
                                 (uint8_t)(sinf(pos*3.1416f)*225+10)));
  }
  off++; strip.show(); delay(38);
}

// 6.8 Disolucion Cromatica
void eff_ChromaticDissolution() {
  static uint8_t  alpha[12];
  static uint16_t tgtHue[12];
  static bool     init=false;
  if(!init){ for(int i=0;i<N;i++){ alpha[i]=random(50,255); tgtHue[i]=random(65536); } init=true; }
  for(int i=0;i<N;i++){
    if(random(28)==0) tgtHue[i]=random(65536);
    strip.setPixelColor(i, chsv(tgtHue[i],200,alpha[i]));
    alpha[i]=(alpha[i]>4)?(alpha[i]-2):255;
  }
  strip.show(); delay(28);
}

// ============================================================
// GRUPO 7 - ARCOIRIS / PRISMATICOS
// ============================================================

// 7.1 Arcoiris Giratorio
void eff_RotatingRainbow() {
  static uint16_t hue=0;
  for(int i=0;i<N;i++) strip.setPixelColor(i, chsv(hue+(i*65536L/N),255,200));
  hue+=280; strip.show(); delay(18);
}

// 7.2 Prisma Dinamico
void eff_DynamicPrism() {
  static float t=0;
  for(int i=0;i<N;i++){
    float a=(float)i/N*6.2832f;
    float v=sinf(a+t)*cosf(a*2-t*0.7f);
    strip.setPixelColor(i, chsv((uint16_t)((v+1.0f)*0.5f*65535+t*280), 220+v*28, 200));
  }
  t+=0.06f; strip.show(); delay(22);
}

// 7.3 Difraccion (patron entrelazado)
void eff_Diffraction() {
  static uint16_t off=0;
  for(int i=0;i<N;i++) strip.setPixelColor(i, chsv((uint16_t)((i*7+off)%N*65536L/N), 255, 200));
  off++; strip.show(); delay(58);
}

// 7.4 Laser Arcoiris
void eff_RainbowLaser() {
  static uint16_t pos=0, hue=0;
  strip.clear();
  strip.setPixelColor(pos%N, chsv(hue,255,255));
  for(int r=1;r<4;r++){
    strip.setPixelColor((pos+r*3)%N, chsv(hue+r*8000,255,195-r*38));
    strip.setPixelColor((pos-r*3+N)%N, chsv(hue-r*8000,255,195-r*38));
  }
  pos++; hue+=480; strip.show(); delay(32);
}

// 7.5 Caleidoscopio
void eff_Kaleidoscope() {
  static uint16_t t=0;
  for(int i=0;i<N/2;i++){
    float v=sinf(i*0.8f+t*0.05f)*cosf(i*0.4f-t*0.03f);
    uint8_t b=(uint8_t)((v+1.0f)*105+28);
    strip.setPixelColor(i,       chsv(t*200+(uint16_t)(i*(65536/(N/2))),   255, b));
    strip.setPixelColor(N-1-i,   chsv(t*200-(uint16_t)(i*(65536/(N/2))),   255, b));
  }
  t++; strip.show(); delay(22);
}

// 7.6 Espectro Solar
void eff_SolarSpectrum() {
  static float phase=0;
  for(int i=0;i<N;i++){
    float t=(float)i/N;
    float w=sinf(t*6.2832f*2+phase);
    strip.setPixelColor(i, chsv((uint16_t)(t*43690), 255, (uint8_t)((w+1.0f)*95+78)));
  }
  phase+=0.05f; strip.show(); delay(22);
}

// 7.7 Irisacion (shimmer)
void eff_Irisation() {
  static uint16_t t=0;
  for(int i=0;i<N;i++){
    float a=(float)i/N*6.2832f;
    float sh=sinf(a*5+t*0.08f)*sinf(a*3-t*0.05f);
    strip.setPixelColor(i, chsv((uint16_t)(a/6.2832f*65535+t*280), (uint8_t)(175+sh*68), (uint8_t)((sh+1.0f)*75+100)));
  }
  t++; strip.show(); delay(22);
}

// 7.8 Burbuja Prismatica
void eff_PrismaticBubble() {
  static float t=0;
  float center=(sinf(t)+1.0f)*N*0.5f;
  for(int i=0;i<N;i++){
    float d=fabsf(i-center);
    if(d>N/2) d=N-d;
    float v=1.0f-d/(N*0.5f);
    strip.setPixelColor(i, chsv((uint16_t)(t*490+i*(65536/N)), 255, (uint8_t)(v*225+8)));
  }
  t+=0.05f; strip.show(); delay(22);
}

// ============================================================
// GRUPO 8 - PULSOS / LATIDOS
// ============================================================

// 8.1 Latido del Corazon
void eff_Heartbeat() {
  const uint8_t pat[]={0,90,255,195,45,0,240,185,45,0,0,0,0,0,0,0};
  uint32_t c=strip.Color(215,0,28);
  for(int b=0;b<16;b++){ fillAll(dimC(c,pat[b])); delay(78); }
  delay(390);
}

// 8.2 Sonar
void eff_Sonar() {
  static int pos=0;
  strip.clear();
  strip.setPixelColor(pos, strip.Color(0,255,100));
  for(int echo=1;echo<=4;echo++){
    int ep=(pos-echo*2+N)%N;
    uint8_t b=255-echo*55;
    strip.setPixelColor(ep, strip.Color(0,(uint8_t)(b*0.65f),b));
  }
  pos=(pos+1)%N; strip.show(); delay(48);
}

// 8.3 EKG / Cardiografo
void eff_EKG() {
  static int pos=0, pp=0;
  const uint8_t ppat[]={5,5,5,28,255,145,8,195,5,5};
  strip.clear();
  strip.setPixelColor(pos, strip.Color(0,ppat[pp%10],0));
  for(int t=1;t<8;t++){
    int prev=(pos-t+N)%N;
    uint8_t b=(uint8_t)max(0,(int)ppat[(pp-t+20)%10]-t*22);
    strip.setPixelColor(prev, strip.Color(0,b,0));
  }
  pos=(pos+1)%N; pp++; strip.show(); delay(75);
}

// 8.4 Onda Sismica
void eff_SeismicWave() {
  static float t=0;
  for(int i=0;i<N;i++){
    float q=sinf(i*1.5f+t)*sinf(i*0.5f-t*0.3f)*cosf(t*0.5f);
    strip.setPixelColor(i, strip.Color(
      (uint8_t)((q+1.0f)*95+28),
      (uint8_t)((sinf(i+t*0.7f)+1.0f)*28),
      (uint8_t)((cosf(i*2-t)+1.0f)*78)));
  }
  t+=0.11f; strip.show(); delay(22);
}

// 8.5 Pulso de Cuarzo
void eff_QuartzPulse() {
  for(int rep=0;rep<3;rep++){
    for(int b=0;b<=255;b+=10){ fillAll(strip.Color((uint8_t)(b*0.28f),(uint8_t)(b*0.68f),b)); delay(9); }
    for(int b=255;b>=0;b-=8){  fillAll(strip.Color((uint8_t)(b*0.28f),(uint8_t)(b*0.68f),b)); delay(11); }
    delay(195);
  }
}

// 8.6 Radar
void eff_Radar() {
  static uint16_t angle=0;
  strip.clear();
  int pos=(int)((float)angle/65536.0f*N);
  strip.setPixelColor(pos, strip.Color(0,255,0));
  for(int t=1;t<N;t++){
    int prev=(pos-t+N)%N;
    uint8_t b=(uint8_t)(255-t*(255/N));
    strip.setPixelColor(prev, strip.Color(0,(uint8_t)(b*0.28f),0));
  }
  angle+=1000; strip.show(); delay(28);
}

// 8.7 Vibracion Resonante
void eff_Resonance() {
  static float freq=1.0f, t=0, fdir=0.01f;
  freq+=fdir;
  if(freq>5.0f||freq<0.5f) fdir=-fdir;
  for(int i=0;i<N;i++){
    float v=sinf((float)i/N*6.2832f*freq+t);
    strip.setPixelColor(i, strip.Color(
      (uint8_t)((v+1.0f)*95),
      (uint8_t)((sinf((float)i/N*6.2832f*(freq+1)-t)+1.0f)*48),
      (uint8_t)((cosf((float)i/N*6.2832f*freq*2+t*0.5f)+1.0f)*95)));
  }
  t+=0.1f; strip.show(); delay(18);
}

// 8.8 Ping Pong Luminoso
void eff_LightPingPong() {
  static float pos=0, vel=0.32f;
  if(pos>=N-1||pos<=0) vel=-vel;
  pos+=vel;
  int ip=(int)pos;
  float fr=pos-ip;
  strip.clear();
  strip.setPixelColor(ip,   strip.Color((uint8_t)(250*(1-fr)),(uint8_t)(95*(1-fr)),(uint8_t)(195*(1-fr))));
  if(ip+1<N) strip.setPixelColor(ip+1, strip.Color((uint8_t)(250*fr),(uint8_t)(95*fr),(uint8_t)(195*fr)));
  for(int t=1;t<5;t++){
    int p=(int)pos-t;
    if(p>=0){ uint8_t b=190-t*44; strip.setPixelColor(p, strip.Color(b,(uint8_t)(b*0.38f),(uint8_t)(b*0.78f))); }
  }
  strip.show(); delay(18);
}

// ============================================================
// GRUPO 9 - MATRIX / DIGITAL
// ============================================================

// 9.1 Matrix Rain
void eff_MatrixRain() {
  static uint8_t br[12]={0};
  for(int i=0;i<N;i++){
    if(br[i]>18) br[i]-=18; else br[i]=0;
    if(random(13)==0) br[i]=255;
    strip.setPixelColor(i, strip.Color(0,br[i],(uint8_t)(br[i]*0.28f)));
  }
  strip.show(); delay(55);
}

// 9.2 Codigo Binario
void eff_BinaryCode() {
  for(int bv=0;bv<256;bv+=16){
    strip.clear();
    for(int bit=0;bit<N;bit++){
      if((bv>>(bit%8))&1) strip.setPixelColor(bit, strip.Color(0,195,0));
      else                 strip.setPixelColor(bit, strip.Color(0,14,0));
    }
    strip.show(); delay(145);
  }
}

// 9.3 Glitch Digital
void eff_DigitalGlitch() {
  for(int frame=0;frame<42;frame++){
    for(int i=0;i<N;i++){
      if(random(4)==0){
        uint8_t v=random(2)*255, ch=random(3);
        strip.setPixelColor(i, strip.Color(ch==0?v:random(28), ch==1?v:random(28), ch==2?v:random(28)));
      } else strip.setPixelColor(i,0);
    }
    strip.show(); delay(random(18,95));
  }
}

// 9.4 Scanner Laser
void eff_LaserScanner() {
  static int pos=0, dir=1;
  strip.clear();
  strip.setPixelColor(pos, strip.Color(255,0,0));
  for(int t=1;t<4;t++){
    int prev=pos-dir*t;
    if(prev>=0&&prev<N){ uint8_t b=195-t*58; strip.setPixelColor(prev, strip.Color(b,0,0)); }
  }
  pos+=dir;
  if(pos>=N-1||pos<=0) dir=-dir;
  strip.show(); delay(38);
}

// 9.5 Circuito PCB
void eff_PCBCircuit() {
  static uint16_t t=0;
  for(int i=0;i<N;i++){
    bool active=((i+t/3)%4==0)||((i+t/5)%7==0);
    if(active) strip.setPixelColor(i, strip.Color(0,175,55));
    else{
      uint8_t dim=((t+i*13)%40)<5?28:5;
      strip.setPixelColor(i, strip.Color(0,dim,(uint8_t)(dim/3)));
    }
  }
  t++; strip.show(); delay(48);
}

// 9.6 Bit Shift
void eff_BitShift() {
  static uint16_t data=0b101010101010;
  static uint8_t  tmr=0;
  if(tmr++>5){ data=(data>>1)|((data&1)<<(N-1)); tmr=0; }
  for(int i=0;i<N;i++){
    bool on=(data>>i)&1;
    strip.setPixelColor(i, on?strip.Color(0,250,95):strip.Color(0,9,4));
  }
  strip.show(); delay(38);
}

// 9.7 Interferencia Digital
void eff_DigitalInterference() {
  static uint16_t t=0;
  for(int i=0;i<N;i++){
    uint16_t v=(i*13+t*7)^(i*7+t*13);
    strip.setPixelColor(i, strip.Color(
      ((v&0xFF)>200)?195:0,
      (((v>>3)&0xFF)>200)?195:0,
      (((v>>5)&0xFF)>200)?195:0));
  }
  t++; strip.show(); delay(55);
}

// 9.8 Onda Cuadrada Cromatica
void eff_SquareWave() {
  static uint16_t phase=0, hue=0;
  for(int i=0;i<N;i++){
    bool on=((i+phase/2)%(3*2))<3;
    strip.setPixelColor(i, on?chsv(hue+i*4800,255,200):strip.Color(0,0,0));
  }
  phase++; hue+=190; strip.show(); delay(75);
}

// ============================================================
// GRUPO 10 - AURORA BOREAL
// ============================================================

// 10.1 Aurora Verde Clasica
void eff_AuroraGreen() {
  static float t=0;
  for(int i=0;i<N;i++){
    float v1=sinf((float)i/N*5+t*0.03f);
    float v2=sinf((float)i/N*3-t*0.02f);
    float v=(v1+v2)*0.5f;
    strip.setPixelColor(i, strip.Color(0,(uint8_t)((v+1.0f)*95+78),(uint8_t)((v+1.0f)*38+18)));
  }
  t++; strip.show(); delay(28);
}

// 10.2 Aurora Multicolor
void eff_AuroraMulticolor() {
  static float t=0;
  for(int i=0;i<N;i++){
    float pos=(float)i/N;
    float wave=sinf(pos*6.2832f*2+t*0.04f)*0.5f+sinf(pos*6.2832f*3-t*0.03f)*0.3f+0.2f;
    strip.setPixelColor(i, chsv(21845+(uint16_t)(wave*14500), 200, (uint8_t)max(0,min(255,(int)(wave*245)))));
  }
  t++; strip.show(); delay(28);
}

// 10.3 Cortina Boreal
void eff_BorealCurtain() {
  static float t=0, curtain[12]={0};
  for(int i=0;i<N;i++){
    curtain[i]=curtain[i]*0.9f+sinf(i*1.5f+t)*0.1f;
    float v=curtain[i];
    strip.setPixelColor(i, strip.Color(
      (uint8_t)max(0,(int)((v-0.5f)*55)),
      (uint8_t)((v+1.0f)*95+48),
      (uint8_t)((sinf(i*0.7f-t*0.02f)+1.0f)*48+28)));
  }
  t+=0.05f; strip.show(); delay(28);
}

// 10.4 Ondas Magneticas
void eff_MagneticWaves() {
  static uint16_t t=0;
  for(int i=0;i<N;i++){
    float a=(float)i/N*6.2832f;
    float f=sinf(a*3+t*0.04f)*cosf(a-t*0.02f);
    strip.setPixelColor(i, chsv(21845+(uint16_t)(f*7800), 220, (uint8_t)((f+1.0f)*95+58)));
  }
  t++; strip.show(); delay(22);
}

// 10.5 Nebulosa Fria
void eff_ColdNebula() {
  static float t=0;
  for(int i=0;i<N;i++){
    float n=sinf(i*0.7f+t)*sinf(i*1.3f-t*0.6f)*cosf(i*0.5f+t*0.4f);
    strip.setPixelColor(i, strip.Color(0,(uint8_t)((n+1.0f)*58+38),(uint8_t)((n+1.0f)*115+78)));
  }
  t+=0.06f; strip.show(); delay(28);
}

// 10.6 Destello Polar
void eff_PolarFlash() {
  uint32_t ac[]={strip.Color(0,195,95), strip.Color(0,95,195), strip.Color(48,215,48), strip.Color(95,48,215)};
  for(int f=0;f<8;f++){
    uint32_t c=ac[f%4];
    for(int b=0;b<=255;b+=14){ fillAll(dimC(c,b)); delay(9); }
    delay(random(95,480));
    for(int b=255;b>=0;b-=10){ fillAll(dimC(c,b)); delay(9); }
  }
}

// 10.7 Plasma Ionosferico
void eff_IonosphericPlasma() {
  static float t=0;
  for(int i=0;i<N;i++){
    float x=(float)i/N*4;
    float pl=(sinf(x+t)+sinf(x*2-t*0.7f)+sinf(x*0.5f+t*0.5f))/3.0f;
    strip.setPixelColor(i, chsv(16384+(uint16_t)(pl*11500), 220, (uint8_t)((pl+1.0f)*95+48)));
  }
  t+=0.04f; strip.show(); delay(22);
}

// 10.8 Viento Solar
void eff_SolarWind() {
  static float   parts[6]={0,2,4,6,8,10};
  static float   spds[6]={0.3f,0.5f,0.4f,0.6f,0.35f,0.45f};
  static uint16_t hs[6]={21845,26000,18000,24000,20000,23000};
  strip.clear();
  for(int p=0;p<6;p++){
    parts[p]+=spds[p];
    if(parts[p]>=N) parts[p]-=N;
    int ip=(int)parts[p];
    float fr=parts[p]-ip;
    strip.setPixelColor(ip,            chsv(hs[p],200,(uint8_t)(195*(1-fr))));
    strip.setPixelColor((ip+1)%N,      chsv(hs[p],200,(uint8_t)(195*fr)));
  }
  strip.show(); delay(28);
}

// ============================================================
// TABLA DE EFECTOS (punteros a funciones)
// ============================================================
typedef void (*EffFn)();

const EffFn effects[10][8] = {
  // G1 Cosmico
  { eff_Nebula,      eff_BlackHole,      eff_Supernova,    eff_StarTwinkle,
    eff_MilkyWay,    eff_Pulsar,         eff_Galaxy,       eff_Wormhole },
  // G2 Fuego/Energia
  { eff_Fire,        eff_Plasma,         eff_Lightning,    eff_LavaLamp,
    eff_BurningHeart,eff_EnergyOverload, eff_RotatingSun,  eff_PhotonStorm },
  // G3 Agua/Ocean
  { eff_OceanWaves,  eff_Bioluminescence,eff_WaterMirror,  eff_IceFractal,
    eff_RainDrop,    eff_Tsunami,        eff_CoralGlow,    eff_IceCrystal },
  // G4 Explosiones
  { eff_BigBang,     eff_Fireworks,      eff_NuclearBlast, eff_Confetti,
    eff_QuantumCollapse,eff_Fragmentation,eff_ImpactPulse, eff_ExpansionRing },
  // G5 Espirales
  { eff_HypnoticSpiral,eff_DoubleSpiral, eff_ColorVortex,  eff_ChromaticHelix,
    eff_NewtonPendulum,eff_TricolorWhirl,eff_FibonacciSpiral,eff_BicolorTornado },
  // G6 Desvanecimientos
  { eff_RainbowBreath,eff_SmoothChromatic,eff_WaveGradient,eff_SoftAurora,
    eff_LatentBreath,eff_QuantumPulse,  eff_FadeWave,     eff_ChromaticDissolution },
  // G7 Arcoiris
  { eff_RotatingRainbow,eff_DynamicPrism,eff_Diffraction,  eff_RainbowLaser,
    eff_Kaleidoscope,eff_SolarSpectrum, eff_Irisation,    eff_PrismaticBubble },
  // G8 Pulsos
  { eff_Heartbeat,   eff_Sonar,          eff_EKG,          eff_SeismicWave,
    eff_QuartzPulse, eff_Radar,          eff_Resonance,    eff_LightPingPong },
  // G9 Digital
  { eff_MatrixRain,  eff_BinaryCode,     eff_DigitalGlitch,eff_LaserScanner,
    eff_PCBCircuit,  eff_BitShift,       eff_DigitalInterference,eff_SquareWave },
  // G10 Aurora
  { eff_AuroraGreen, eff_AuroraMulticolor,eff_BorealCurtain,eff_MagneticWaves,
    eff_ColdNebula,  eff_PolarFlash,     eff_IonosphericPlasma,eff_SolarWind }
};

// Color de identificacion de cada grupo para transicion
const uint32_t groupColors[10] = {
  0x8800FF,  // G1 cosmico
  0xFF4400,  // G2 fuego
  0x0044FF,  // G3 agua
  0xFF8800,  // G4 explosion
  0xFF00FF,  // G5 espiral
  0x00FF88,  // G6 fade
  0xFFFF00,  // G7 arcoiris
  0xFF0044,  // G8 pulso
  0x00FF00,  // G9 digital
  0x00FFCC,  // G10 aurora
};

// Tipo de transicion para cada grupo (0-4)
const uint8_t groupTransTypes[10] = { 0, 1, 2, 3, 4, 0, 1, 2, 3, 4 };

void doGroupTransition(uint8_t nextGroup) {
  switch(groupTransTypes[nextGroup]){
    case 0: transWipe(groupColors[nextGroup]);       break;
    case 1: transFade(800);                          break;
    case 2: transSpiral(groupColors[nextGroup]);     break;
    case 3: transFlash(groupColors[nextGroup], 4);   break;
    case 4: transExplosion(groupColors[nextGroup]);  break;
  }
}

// ============================================================
// SETUP
// ============================================================
void setup() {
  ring1.begin();
  ring1.setBrightness(BRIGHTNESS);
  ring1.clear();
  ring1.show();

  // Anillos / tiras adicionales - descomentar para activar:
  // ring2.begin();  ring2.setBrightness(BRIGHTNESS);  ring2.clear();  ring2.show();
  // strip1.begin(); strip1.setBrightness(BRIGHTNESS); strip1.clear(); strip1.show();

  randomSeed(analogRead(A0));

  Serial.begin(9600);
  Serial.println(F("=== NeoPixel 80 Efectos ==="));
  Serial.println(F("PIN: 7  |  LEDs: 12  |  Grupos: 10 x 8"));

  effectGroup = 0;
  effectIdx   = 0;
  lastChange  = millis();
}

// ============================================================
// LOOP PRINCIPAL
// ============================================================
void loop() {
  unsigned long now = millis();
  uint16_t dur = pgm_read_word(&effectDurations[effectGroup][effectIdx]);

  if(now - lastChange >= dur) {
    effectIdx++;
    if(effectIdx >= 8) {
      effectIdx = 0;
      uint8_t next = (effectGroup + 1) % 10;
      Serial.print(F("Transicion -> Grupo "));
      Serial.println(next + 1);
      doGroupTransition(next);
      effectGroup = next;
    }
    lastChange = millis();
    Serial.print(F("  Efecto "));
    Serial.print(effectIdx + 1);
    Serial.print(F(" / 8  [Grupo "));
    Serial.print(effectGroup + 1);
    Serial.println(F("]"));
  }

  // Ejecutar efecto activo
  effects[effectGroup][effectIdx]();
}
