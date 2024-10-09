FROM public.ecr.aws/lambda/nodejs:20

COPY /src/package*.json ./
COPY /src/tsconfig.json ./tsconfig.json
COPY /src/sentiment-handler ./sentiment-handler
RUN npm install

# ENTRYPOINT [ "node"]
CMD [ "sentiment-handler/index.handler"]