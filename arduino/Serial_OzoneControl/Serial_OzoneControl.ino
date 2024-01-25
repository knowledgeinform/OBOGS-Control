#include <stdlib.h>
#include <memory>
#include <string.h>

using namespace std; 



#define RELAY_DIGITAL_PIN 4     // Output Pin number
#define UV_ANALOG_PIN A1     //Analog Input Pin number
#define R_SENSE 164.3     //resistance on 4-20 mA input
#define DEFAULT_PERIOD 4     //INTEGER Duty Cycle Period in Seconds
#define DEFAULT_DUTY_CYCLE 10    //Duty Cycle Value in Percent (0-100, 2 decimal places)
#define SLOPE 30.9
#define INTERCEPT 0
// #define SLOPE 52.374    //calibration slope
// #define INTERCEPT -36.555     //calibration intercept
#define MAX_MESSAGE_LENGTH 32

#define BAUD_RATE 115200

#define DEBUG 0


class OzoneControl {
    private: 
        //Control pins and UV data 
        int relayPin;
        int uvPin;
        float uvData;

        float R_sense;
        float slope;
        float intercept;

        //PWM variables
        float period;
        float dutyCycle;
        unsigned long long int startTime;
        unsigned int onTimeMS;
        unsigned int offTimeMS;
        bool pwmState;
        bool powerState;


        


    public:

        char receivedChars[MAX_MESSAGE_LENGTH];
        char tempChars[MAX_MESSAGE_LENGTH];
        char msgType[MAX_MESSAGE_LENGTH];
        float msgValue = 0; 
        bool newData = false; 

        OzoneControl(){
            this->relayPin = RELAY_DIGITAL_PIN;
            this->uvPin = UV_ANALOG_PIN;

            this->R_sense = R_SENSE;
            this->slope = SLOPE;
            this->intercept = INTERCEPT;

            this->period = DEFAULT_PERIOD;
            this->dutyCycle = DEFAULT_DUTY_CYCLE;
            this->pwmState = false; 
            this->powerState = false; 




            this->initializePins();
            this->computeTimers();
            this->set_startTime();
        }

        void initializePins(){
            pinMode(this->relayPin,OUTPUT);
            digitalWrite(this->relayPin,LOW);

            pinMode(this->uvPin,INPUT);
            analogReadResolution(12);
        }

        void computeTimers(){
            this->onTimeMS = this->dutyCycle*this->period*10; //convert to ms by multiplying percent*10
            this->offTimeMS = this->period*1000 - this->onTimeMS;
            // Serial.println(onTimeMS);
            // Serial.println(offTimeMS);
        }

        void togglePWM(){
            if (DEBUG) Serial.println("tP1");
            if (millis()-this->startTime > this->offTimeMS && !digitalRead(this->relayPin)){
                digitalWrite(this->relayPin,HIGH);
//                this->pwmState = !(this->pwmState);
                this->startTime = millis();
                // Serial.println("ON - Resetting startTime");
            }else if (millis()-this->startTime > this->onTimeMS && digitalRead(this->relayPin)){
                digitalWrite(this->relayPin,LOW);
//                this->pwmState = !(this->pwmState);
                this->startTime = millis();
                // Serial.println("OFF - Resetting startTime");
            }
        }

        void set_powerState(bool new_powerState){
            this->powerState = new_powerState;
            digitalWrite(this->relayPin,LOW);
            // digitalWrite(this->uvPin,LOW); resulted in error
        }

        bool get_powerState(){
            return this->powerState;
        }

        void set_startTime(){
            this->startTime = millis();
        }

        unsigned long long int get_startTime(){
            return this->startTime;
        }

        void set_period(float new_period){
            this->period = new_period;
            this->computeTimers();
        }

        float get_period(){
            return this->period;
        }

        void set_dutyCycle(float new_dutyCycle){
            this->dutyCycle = new_dutyCycle;
            this->computeTimers();
        }

        float get_dutyCycle(){
            return this->dutyCycle;
        }

        float get_uvData(){
           this->uvData = this->slope * ((float) analogRead(this->uvPin)*3.3/4095) + this->intercept;
            return this->uvData;
        }

        void receieveData(){
            // if (DEBUG) Serial.println("rD1");
            static bool recvInProgress = false; 
            static int ndx = 0; 
            char startMarker = '<';
            char endMarker = '>';
            int rc; 
            // if (Serial.available() < 3) return;
            while (Serial.available() > 0 && this->newData == false){
                // Serial.write(this->receivedChars, MAX_MESSAGE_LENGTH);
                // Serial.println(":");
                rc = Serial.read();

                 if (recvInProgress == true) {
                    if (rc != endMarker && ndx < MAX_MESSAGE_LENGTH) {
                        this->receivedChars[ndx] = static_cast<char>(rc);
                        ndx++;
                        if (ndx >= MAX_MESSAGE_LENGTH){
                            ndx = MAX_MESSAGE_LENGTH - 1;
                        }
                    }
                    else {
                        if (ndx >= MAX_MESSAGE_LENGTH){
                            ndx = MAX_MESSAGE_LENGTH - 1;
                        }
                        this->receivedChars[ndx] = '\0';
                        recvInProgress = false; 
                        ndx = 0; 
                        this->newData = true;
                        if (DEBUG) Serial.println("rD3");
                        // Serial.println("Setting newData = true");
                    }
                 }
                 else if (rc == startMarker){
                    if (DEBUG) Serial.println("rD2");
                    recvInProgress = true;
                 }
              // delayMicroseconds(200); // about 3x the time for a single byte to be transmitted
            }
        }

        void parseData(){
            if (DEBUG) Serial.println("pD1");
            char * strtokIdx;

            strtokIdx = strtok(this->tempChars, ":");
            strncpy(this->msgType,this->tempChars, MAX_MESSAGE_LENGTH);
            this->msgType[MAX_MESSAGE_LENGTH - 1] = '\0'; // ensures a null-terminated string

            strtokIdx = strtok(NULL, ",");
            this->msgValue = strtof(strtokIdx, NULL);
            if (DEBUG) Serial.println("pD2");
            if (strncmp(this->msgType,"on", 2)==0){
                set_powerState(true);
                Serial.println("<ack:on>");
            }
            else if (strncmp(this->msgType,"off", 3)==0){
                set_powerState(false);
                Serial.println("<ack:off>");
            }
            else if (strncmp(this->msgType,"gS",2) == 0){
              bool state = get_powerState();
              Serial.print("<gS:");
              Serial.print(state);
              Serial.println(">");
            }
            else if (strncmp(this->msgType,"q", 1)==0){
                get_uvData();
                Serial.print("<data:");
                Serial.print(this->uvData);
                Serial.println(">");
            }
            else if (strncmp(this->msgType,"p", 1)==0){
                if (msgValue >= 0) set_period((msgValue));
                else msgValue = get_period();
                Serial.print("<ack:");
                Serial.print(msgType);
                Serial.print(msgValue);
                Serial.println(">");
            }
            else if (strncmp(this->msgType,"gp", 2)==0){
                float val = get_period();
                Serial.print("<gp:");
                Serial.print(val);
                Serial.println(">");
            }
            else if (strncmp(this->msgType,"d", 1)==0){
                if (msgValue >= 0) set_dutyCycle((msgValue));
                else msgValue = get_dutyCycle();
                Serial.print("<ack:");
                Serial.print(msgType);
                Serial.print(msgValue);
                Serial.println(">");
            }
            else if (strncmp(this->msgType,"gd", 2)==0){
                float val = get_dutyCycle();
                Serial.print("<gd:");
                Serial.print(val);
                Serial.println(">");
            }
            else{
            }

            Serial.flush(); // waits to complete the transmission (if any)

        }
};




std::shared_ptr<OzoneControl> oC;

// OzoneControl *oC;

void setup(){
    Serial.begin(BAUD_RATE);
    oC = std::make_shared<OzoneControl>();
    // OzoneControl ocTemp;
    // oC = &ocTemp;


    //Clears the serial input buffer of random characters on startup
    // while (Serial.available() > 0) {
    //   Serial.read();
    // }

}

void loop(){
    
    oC->receieveData();
    if (oC->newData == true){
        strncpy(oC->tempChars, oC->receivedChars, MAX_MESSAGE_LENGTH);

        // Serial.print("newData = ");
        // Serial.println(oC->newData);


        oC->parseData();
        oC->newData = false; 
    }
    // Serial.println(oC->get_powerState());
    if (oC->get_powerState()){
        // Serial.print("Got power state: ");
        // Serial.println(oC->get_powerState());
        oC->togglePWM();
    }
    // delay(20);
    // Serial.println("LOOP()");

}
