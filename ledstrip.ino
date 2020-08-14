#include <FastLED.h>
#define DATA_PIN 11
#define POT A0
#define NUM_LEDS 148
#define TBF_SIZE 240 // multiple of 6
#define MBF_SIZE 888 // 6 bytes per led 

CRGB leds[NUM_LEDS];

char temp_buffer[TBF_SIZE];
char main_buffer[MBF_SIZE];
char hex_buf[6];
int buf_size = 0;
int tmp_size = 0;

unsigned long s; // timing start
unsigned long e; // timing end

void setup() {
    Serial.begin(2000000);
    
    pinMode(POT, INPUT);
    FastLED.addLeds <WS2812B, DATA_PIN, GRB>(leds, NUM_LEDS);

    // server calculates delay based on subtraction, negative gets buffed to 0, first frame should be shown immediately
    Serial.println("1000 ms");
}

void fillTemp(int bytes) {    
    int i = 0;
    for(i = 0; i < bytes && i < TBF_SIZE; i++) {
        while(!Serial.available());
        char c = Serial.read();
        temp_buffer[i] = c;
    }
    
    tmp_size = i;
}

void fillMain(int bytes) {
    buf_size = 0;
    while(buf_size < bytes && buf_size < MBF_SIZE) {
        fillTemp(bytes - buf_size);
        memcpy(main_buffer + buf_size, temp_buffer, tmp_size);
        buf_size += tmp_size;
    }
}

void parseBuffer() {
    int len = buf_size - buf_size % 6;
    for(int i = 0; i < len; i += 6) {

        // could of used a loop but i thought this might make it faster
        hex_buf[0] = main_buffer[i + 0]; 
        hex_buf[1] = main_buffer[i + 1];
        hex_buf[2] = main_buffer[i + 2];
        hex_buf[3] = main_buffer[i + 3];
        hex_buf[4] = main_buffer[i + 4];
        hex_buf[5] = main_buffer[i + 5];
        
        long l = strtol(hex_buf, NULL, 16);
        byte led = i / 6;

        leds[led].r = l >> 16;
        leds[led].g = l >> 8 & 0xFF;
        leds[led].b = l & 0xFF;
    }
}

byte brightness = 100;
byte newbright;

void loop() {
    if(Serial.available()) {
        if(Serial.peek() == 'r') {
            Serial.println("buffer cleared");
            Serial.read();
            tmp_size = 0;
        }

        
        s = millis();
        fillMain(MBF_SIZE);
        tmp_size = 0;
        parseBuffer();
        FastLED.show();
        e = millis();
        Serial.print(e - s);
        Serial.println(" ms");
    }
    
    newbright = map(analogRead(POT), 0, 1023, 0, 255);
    if(brightness != newbright) {
        brightness = newbright;  
        FastLED.setBrightness(brightness);     
    }
}
