# EpidemicSimulationSandbox
Passion Project for Advanced Computer Science at the Mass Academy of Math and Science made by Atharv Joshi and Arnav Prabhudesai


# How to run the frontend

In the terminal, run:

```
cd v-0.2-earthdata/my-react-app

npm i

npm run dev
```

Copy and paste the url that it gives you (ex: localhost: 5173)

Enjoy!


# How to run the transfer system
Open `v-0.2-earthdata/backend/sender.html`

Input all the data it asks for (leave the Server URL field as the default value)

Open `v-0.2-earthdata/backend/receiver.html`

Wait for the server to connect. If the server has disabled due to inactivity, this could take up to a minute. Accept the download of the first frame.


# How to run the simulator

Run `v-0.2-earthdata/EarthdataSimulator.m` in MATLAB. The frames will be outputted at the location of `v-0.2-earthdata/backend/sim_frame.bin`

The output file will be in the format of a 3MB binary file which represents a 720x1440 image with one byte for red, one byte for green, and one byte for blue.

# Project Overview

Our model accurately simulates virus spread for a certain set of parameters. It has a high amount of customizability as it allows user modification of parameters for virus spread. The model visually represents the results by a world map UI that shows the impact of the virus where a larger red circle means more people are infected, aand a more red circle means more people are infected 

The system follows a SEIRDS model (Susceptible -> Exposed -> Infected -> Recovered/Dead -> Susceptable)

So far, the system has these parameters:
- Infectivity
- Deadliness
- Heal Rate
- Immunity Loss Rate
- Severity
- Spreadability

In addition, the system also uses real population data, gathered by NASA in 2020.

Documentation can be found at: http://sedac.ciesin.columbia.edu/data/collection/gpw-v4/documentation

More data can be found at: http://sedac.ciesin.columbia.edu/data/collection/gpw-v4/sets/browse


# Next Steps

After building a successful MVP, here are our next steps to make the project more realistic, and to turn it into a deployable solution.

- Implement the ability to travel in the simulation

- Clairy and configure the server connecting the backend --> frontend (doesn't work exactly how we want it to right now... The system downloads the first frame as a MVP of the transfer system. It does not yet provide a steady 10fps stream of binary simulation data).

- Implement the ability to drop the virus onto the simulation... right now, the virus just spawns in Lebanon!!

- Implement connectivity from the frontend --> backend, so that changing sliders actually changes the sim.

- Create better/more accurate preventative measures in place of our blanket "vaccinate" button in MATLAB which just turns 75% of the population into Recovered people

- Add realistic "mutation rate" that can be customized by the user

- Add new and more interesting virus shapes and colors and different virus types

- Add slider for the speed of the simulation


Then we'll have a finished product!


Let us know if you have any concerns or questions!

Best,
Atharv and Arnav